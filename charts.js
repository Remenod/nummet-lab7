const COLORS = {
  exact: "#172121",
  plain: "#b64620",
  controlled: "#00736d",
  doubledPlain: "#836600",
  doubledControlled: "#63518f",
};

const CASE_STYLES = {
  basePlain: {
    color: COLORS.plain,
    dash: [8, 5],
  },
  baseControlled: {
    color: COLORS.controlled,
    dash: [10, 4, 2, 4],
  },
  doublePlain: {
    color: COLORS.doubledPlain,
    dash: [8, 5],
  },
  doubleControlled: {
    color: COLORS.doubledControlled,
    dash: [10, 4, 2, 4],
  },
};

const chartState = {
  results: null,
  chartViews: {
    base: null,
    double: null,
  },
  chartInstances: new Map(),
  boxZoom: false,
};

function renderCharts(results) {
  chartState.results = results;
  renderChartsOnly();
}

function resetChartViews() {
  chartState.chartViews.base = null;
  chartState.chartViews.double = null;
}

function renderChartsOnly() {
  if (!chartState.results) return;
  const showMarkers = document.querySelector("#markersToggle").checked;
  const baseCases = chartState.results.cases.filter((item) => item.chart === "base");
  const doubleCases = chartState.results.cases.filter((item) => item.chart === "double");

  renderInteractiveChart("base", document.querySelector("#baseChart"), [
    makeExactDataset(baseCases[0]),
    ...baseCases.map(makeCaseDataset),
  ], showMarkers);

  renderInteractiveChart("double", document.querySelector("#doubleChart"), [
    makeExactDataset(doubleCases[0]),
    ...doubleCases.map(makeCaseDataset),
  ], showMarkers);

  drawLegend("#baseLegend", [
    ["Exact solution", COLORS.exact],
    ...baseCases.map((item) => [item.label, CASE_STYLES[item.key].color]),
  ]);
  drawLegend("#doubleLegend", [
    ["Exact solution", COLORS.exact],
    ...doubleCases.map((item) => [item.label, CASE_STYLES[item.key].color]),
  ]);
}

function makeExactDataset(referenceCase) {
  const { VARIANT } = window.LabMath;
  const samples = 300;
  const x = Array.from({ length: samples + 1 }, (_, i) => VARIANT.a + ((VARIANT.b - VARIANT.a) * i) / samples);
  return {
    key: `${referenceCase.chart}Exact`,
    label: "Exact solution",
    x,
    y: x.map(VARIANT.exact),
    color: COLORS.exact,
    dash: [],
    exact: true,
  };
}

function makeCaseDataset(item) {
  const style = CASE_STYLES[item.key];
  return {
    key: item.key,
    label: item.label,
    x: item.t,
    y: item.y,
    color: style.color,
    dash: style.dash,
    exact: false,
  };
}

function drawLegend(selector, items) {
  const legend = document.querySelector(selector);
  legend.innerHTML = "";
  for (const [label, color] of items) {
    const item = document.createElement("span");
    item.style.color = color;
    item.innerHTML = `<i></i>${label}`;
    legend.append(item);
  }
}

function renderInteractiveChart(chartKey, canvas, datasets, showMarkers) {
  const fullDomain = getFullDomain(datasets);
  const view = chartState.chartViews[chartKey] || fullDomain;
  chartState.chartViews[chartKey] = clampView(view, fullDomain);

  const renderer = drawChart(canvas, datasets, showMarkers, chartState.chartViews[chartKey], fullDomain);
  chartState.chartInstances.set(chartKey, { canvas, datasets, fullDomain, renderer });
  attachChartEvents(chartKey, canvas);
}

function getFullDomain(datasets) {
  const points = [];
  for (const dataset of datasets) {
    dataset.x.forEach((x, index) => {
      const y = dataset.y[index];
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    });
  }
  const xMin = Math.min(...points.map((point) => point.x));
  const xMax = Math.max(...points.map((point) => point.x));
  let yMin = Math.min(...points.map((point) => point.y));
  let yMax = Math.max(...points.map((point) => point.y));
  const yPad = Math.max((yMax - yMin) * 0.08, 0.15);
  yMin -= yPad;
  yMax += yPad;
  return { xMin, xMax, yMin, yMax };
}

function clampView(view, full) {
  const minRange = (full.xMax - full.xMin) * 0.03;
  let { xMin, xMax } = view;
  if (xMax - xMin < minRange) {
    const center = (xMin + xMax) / 2;
    xMin = center - minRange / 2;
    xMax = center + minRange / 2;
  }
  if (xMin < full.xMin) {
    xMax += full.xMin - xMin;
    xMin = full.xMin;
  }
  if (xMax > full.xMax) {
    xMin -= xMax - full.xMax;
    xMax = full.xMax;
  }
  if (xMin < full.xMin) xMin = full.xMin;
  if (xMax > full.xMax) xMax = full.xMax;
  return { ...full, xMin, xMax };
}

function drawChart(canvas, datasets, showMarkers, view, fullDomain) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(rect.height));
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { left: 58, right: 18, top: 20, bottom: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xScale = (value) => pad.left + ((value - view.xMin) / (view.xMax - view.xMin || 1)) * plotWidth;
  const yScale = (value) => pad.top + (1 - (value - view.yMin) / (view.yMax - view.yMin || 1)) * plotHeight;
  const xValue = (pixel) => view.xMin + ((pixel - pad.left) / plotWidth) * (view.xMax - view.xMin);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, pad, view, xScale, yScale);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top, plotWidth, plotHeight);
  ctx.clip();
  for (const dataset of datasets) {
    drawDataset(ctx, dataset, xScale, yScale, showMarkers);
  }
  ctx.restore();

  return { ctx, width, height, pad, plotWidth, plotHeight, view, fullDomain, xScale, yScale, xValue };
}

function drawDataset(ctx, dataset, xScale, yScale, showMarkers) {
  ctx.save();
  ctx.strokeStyle = dataset.color;
  ctx.lineWidth = dataset.exact ? 2.4 : 2;
  ctx.setLineDash(dataset.dash);
  ctx.beginPath();
  let started = false;
  dataset.x.forEach((x, index) => {
    const y = dataset.y[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const px = xScale(x);
    const py = yScale(y);
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.stroke();
  ctx.restore();

  if (showMarkers && !dataset.exact) {
    ctx.fillStyle = dataset.color;
    dataset.x.forEach((x, index) => {
      const y = dataset.y[index];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      ctx.beginPath();
      ctx.arc(xScale(x), yScale(y), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawGrid(ctx, width, height, pad, view, xScale, yScale) {
  const { formatNumber } = window.LabMath;
  ctx.save();
  ctx.strokeStyle = "#d9e1de";
  ctx.fillStyle = "#5e6765";
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "middle";

  const ticks = 5;
  for (let i = 0; i <= ticks; i += 1) {
    const xValue = view.xMin + ((view.xMax - view.xMin) * i) / ticks;
    const x = xScale(xValue);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(xValue, 3), x, height - 20);
  }

  for (let i = 0; i <= ticks; i += 1) {
    const yValue = view.yMin + ((view.yMax - view.yMin) * i) / ticks;
    const y = yScale(yValue);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(formatNumber(yValue, 3), pad.left - 8, y);
  }

  ctx.strokeStyle = "#172121";
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();
  ctx.restore();
}

function attachChartEvents(chartKey, canvas) {
  if (canvas.dataset.bound === "true") return;
  canvas.dataset.bound = "true";
  canvas.addEventListener("wheel", (event) => handleWheel(event, chartKey), { passive: false });
  canvas.addEventListener("pointerdown", (event) => handlePointerDown(event, chartKey));
  canvas.addEventListener("pointermove", (event) => handlePointerMove(event, chartKey));
  canvas.addEventListener("pointerup", (event) => handlePointerUp(event, chartKey));
  canvas.addEventListener("pointerleave", (event) => handlePointerLeave(event, chartKey));
  canvas.addEventListener("dblclick", resetZoom);
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function handleWheel(event, chartKey) {
  event.preventDefault();
  const instance = chartState.chartInstances.get(chartKey);
  if (!instance) return;
  const point = getCanvasPoint(event, instance.canvas);
  const { renderer, fullDomain } = instance;
  if (!isInsidePlot(point, renderer)) return;

  const anchor = renderer.xValue(point.x);
  const current = chartState.chartViews[chartKey];
  const zoomFactor = event.deltaY < 0 ? 0.82 : 1.22;
  const nextWidth = (current.xMax - current.xMin) * zoomFactor;
  const ratio = (anchor - current.xMin) / (current.xMax - current.xMin);
  const nextView = clampView({
    ...current,
    xMin: anchor - nextWidth * ratio,
    xMax: anchor + nextWidth * (1 - ratio),
  }, fullDomain);

  setChartView(chartKey, nextView);
}

function handlePointerDown(event, chartKey) {
  const instance = chartState.chartInstances.get(chartKey);
  if (!instance) return;
  const point = getCanvasPoint(event, instance.canvas);
  if (!isInsidePlot(point, instance.renderer)) return;
  instance.canvas.setPointerCapture(event.pointerId);
  instance.canvas._drag = {
    pointerId: event.pointerId,
    start: point,
    current: point,
    view: { ...chartState.chartViews[chartKey] },
    mode: chartState.boxZoom ? "box" : "pan",
  };
}

function handlePointerMove(event, chartKey) {
  const instance = chartState.chartInstances.get(chartKey);
  if (!instance) return;
  const point = getCanvasPoint(event, instance.canvas);
  const drag = instance.canvas._drag;

  if (drag) {
    drag.current = point;
    if (drag.mode === "pan") {
      const deltaPx = point.x - drag.start.x;
      const range = drag.view.xMax - drag.view.xMin;
      const deltaValue = (deltaPx / instance.renderer.plotWidth) * range;
      setChartView(chartKey, clampView({
        ...drag.view,
        xMin: drag.view.xMin - deltaValue,
        xMax: drag.view.xMax - deltaValue,
      }, instance.fullDomain));
    } else {
      renderChartsOnly();
      const fresh = chartState.chartInstances.get(chartKey) || instance;
      drawSelectionBox(fresh, drag);
    }
    return;
  }

  if (!isInsidePlot(point, instance.renderer)) {
    hideTooltip(chartKey);
    return;
  }
  const t = instance.renderer.xValue(point.x);
  const comparison = getComparison(chartKey, t);
  drawHoverOverlay(instance, comparison.t);
  showTooltip(chartKey, point, comparison);
  renderComparison(comparison, "#liveCompareBody", "#liveCompareTitle");
}

function handlePointerUp(event, chartKey) {
  const instance = chartState.chartInstances.get(chartKey);
  if (!instance || !instance.canvas._drag) return;
  const drag = instance.canvas._drag;
  instance.canvas._drag = null;
  if (instance.canvas.hasPointerCapture(event.pointerId)) {
    instance.canvas.releasePointerCapture(event.pointerId);
  }

  if (drag.mode === "box") {
    const x1 = Math.min(drag.start.x, drag.current.x);
    const x2 = Math.max(drag.start.x, drag.current.x);
    if (x2 - x1 > 12) {
      const nextView = clampView({
        ...chartState.chartViews[chartKey],
        xMin: instance.renderer.xValue(x1),
        xMax: instance.renderer.xValue(x2),
      }, instance.fullDomain);
      setChartView(chartKey, nextView);
    } else {
      renderChartsOnly();
    }
    return;
  }

  const point = getCanvasPoint(event, instance.canvas);
  if (Math.abs(point.x - drag.start.x) < 3 && Math.abs(point.y - drag.start.y) < 3) {
    const comparison = getComparison(chartKey, instance.renderer.xValue(point.x));
    renderComparison(comparison, "#pinnedCompareBody", "#pinnedCompareTitle");
  }
}

function handlePointerLeave(event, chartKey) {
  const instance = chartState.chartInstances.get(chartKey);
  if (instance && instance.canvas._drag) return;
  hideTooltip(chartKey);
  renderChartsOnly();
}

function isInsidePlot(point, renderer) {
  return point.x >= renderer.pad.left
    && point.x <= renderer.width - renderer.pad.right
    && point.y >= renderer.pad.top
    && point.y <= renderer.height - renderer.pad.bottom;
}

function setChartView(chartKey, nextView) {
  chartState.chartViews[chartKey] = nextView;
  if (document.querySelector("#syncZoomToggle").checked) {
    const otherKey = chartKey === "base" ? "double" : "base";
    const other = chartState.chartInstances.get(otherKey);
    if (other) chartState.chartViews[otherKey] = clampView(nextView, other.fullDomain);
  }
  renderChartsOnly();
}

function syncChartViews() {
  if (!document.querySelector("#syncZoomToggle").checked || !chartState.chartViews.base) return;
  const double = chartState.chartInstances.get("double");
  if (double) chartState.chartViews.double = clampView(chartState.chartViews.base, double.fullDomain);
  renderChartsOnly();
}

function resetZoom() {
  resetChartViews();
  renderChartsOnly();
}

function toggleBoxZoom() {
  chartState.boxZoom = !chartState.boxZoom;
  const button = document.querySelector("#boxZoomToggle");
  button.classList.toggle("is-active", chartState.boxZoom);
  button.setAttribute("aria-pressed", String(chartState.boxZoom));
}

function clearPinnedPoint() {
  renderComparison(null, "#pinnedCompareBody", "#pinnedCompareTitle");
}

function drawHoverOverlay(instance, t) {
  renderChartsOnly();
  const chartKey = instance.canvas.id.replace("Chart", "");
  const active = chartState.chartInstances.get(chartKey) || instance;
  const x = active.renderer.xScale(t);
  const ctx = active.renderer.ctx;
  ctx.save();
  ctx.strokeStyle = "#172121";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, active.renderer.pad.top);
  ctx.lineTo(x, active.renderer.height - active.renderer.pad.bottom);
  ctx.stroke();
  ctx.restore();
}

function drawSelectionBox(instance, drag) {
  const { renderer } = instance;
  const x = Math.min(drag.start.x, drag.current.x);
  const y = renderer.pad.top;
  const width = Math.abs(drag.current.x - drag.start.x);
  const height = renderer.height - renderer.pad.top - renderer.pad.bottom;
  renderer.ctx.save();
  renderer.ctx.fillStyle = "rgba(0, 115, 109, 0.12)";
  renderer.ctx.strokeStyle = "#00736d";
  renderer.ctx.setLineDash([6, 4]);
  renderer.ctx.fillRect(x, y, width, height);
  renderer.ctx.strokeRect(x, y, width, height);
  renderer.ctx.restore();
}

function getComparison(chartKey, t) {
  const chartCases = chartState.results.cases.filter((item) => item.chart === chartKey);
  const reference = chartCases[0];
  const index = nearestIndex(reference.t, t);
  const nodeT = reference.t[index];
  const exact = reference.exact[index];
  return {
    chartKey,
    t: nodeT,
    rows: [
      {
        label: "Exact solution",
        color: COLORS.exact,
        y: exact,
        error: 0,
      },
      ...chartCases.map((item) => ({
        label: item.label,
        color: CASE_STYLES[item.key].color,
        y: item.y[index],
        predictor: item.p[index],
        error: item.errors[index],
        gap: item.gaps[index],
      })),
    ],
  };
}

function nearestIndex(values, target) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function showTooltip(chartKey, point, comparison) {
  const { formatNumber } = window.LabMath;
  const tooltip = document.querySelector(`#${chartKey}Tooltip`);
  tooltip.hidden = false;
  tooltip.style.left = `${point.x + 12}px`;
  tooltip.style.top = `${Math.max(12, point.y - 20)}px`;
  tooltip.innerHTML = `
    <strong>t = ${formatNumber(comparison.t)}</strong>
    ${comparison.rows.map((row) => `
      <span style="color:${row.color}">
        ${row.label}: ${formatNumber(row.y)}
        ${row.error ? ` · |e| ${formatNumber(row.error)}` : ""}
      </span>
    `).join("")}
  `;
}

function hideTooltip(chartKey) {
  const tooltip = document.querySelector(`#${chartKey}Tooltip`);
  if (tooltip) tooltip.hidden = true;
}

function renderComparison(comparison, bodySelector, titleSelector) {
  const { formatNumber } = window.LabMath;
  const body = document.querySelector(bodySelector);
  const title = document.querySelector(titleSelector);
  body.innerHTML = "";
  title.textContent = comparison ? `t = ${formatNumber(comparison.t)}` : "—";
  if (!comparison) {
    body.innerHTML = '<tr><td colspan="4">—</td></tr>';
    return;
  }
  comparison.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="swatch" style="background:${row.color}"></span>${row.label}</td>
      <td>${formatNumber(row.y)}</td>
      <td>${formatNumber(row.error)}</td>
      <td>${formatNumber(row.gap)}</td>
    `;
    body.append(tr);
  });
}

function clearComparisons() {
  renderComparison(null, "#liveCompareBody", "#liveCompareTitle");
  renderComparison(null, "#pinnedCompareBody", "#pinnedCompareTitle");
}

window.LabCharts = {
  CASE_STYLES,
  clearComparisons,
  clearPinnedPoint,
  renderCharts,
  renderChartsOnly,
  resetChartViews,
  resetZoom,
  syncChartViews,
  toggleBoxZoom,
};
