const appState = {
  results: null,
};

function setupControls() {
  const charts = window.LabCharts;
  document.querySelector("#iterationInput").addEventListener("input", render);
  document.querySelector("#markersToggle").addEventListener("change", charts.renderChartsOnly);
  document.querySelector("#syncZoomToggle").addEventListener("change", charts.syncChartViews);
  document.querySelector("#boxZoomToggle").addEventListener("click", charts.toggleBoxZoom);
  document.querySelector("#resetZoomButton").addEventListener("click", charts.resetZoom);
  document.querySelector("#clearPinButton").addEventListener("click", charts.clearPinnedPoint);
  document.querySelector("#csvButton").addEventListener("click", () => download("csv"));
  document.querySelector("#jsonButton").addEventListener("click", () => download("json"));
  window.addEventListener("resize", charts.renderChartsOnly);
}

function render() {
  const { VARIANT, computeAll } = window.LabMath;
  const charts = window.LabCharts;
  const iterations = Math.max(1, Math.min(6, Number(document.querySelector("#iterationInput").value) || 1));
  appState.results = computeAll(iterations);
  charts.resetChartViews();
  charts.clearComparisons();

  renderSummary(appState.results);
  renderTables(appState.results);
  charts.renderCharts(appState.results);
  document.querySelector("#statusText").textContent = `Variant ${VARIANT.id}`;
}

function renderSummary({ plan, cases }) {
  const { VARIANT, formatNumber } = window.LabMath;
  const best = [...cases].sort((a, b) => a.maxError - b.maxError)[0];
  document.querySelector("#methodMetric").textContent = VARIANT.method;
  document.querySelector("#limitMetric").textContent = `h ≤ ${formatNumber(plan.hLimit)}`;
  document.querySelector("#stepsMetric").textContent = `${formatNumber(plan.baseH)} / ${formatNumber(plan.doubleH)}`;
  document.querySelector("#bestMetric").textContent = best.label.replace(/^[a-d]\)\s*/, "");
  document.querySelector("#variantTitle").textContent = `Variant ${VARIANT.id}: ${VARIANT.method}`;
  document.querySelector("#variantFormula").textContent = VARIANT.equation;
  document.querySelector("#exactFormula").textContent = VARIANT.exactLabel;
  document.querySelector("#intervalText").textContent = `[${formatNumber(VARIANT.a)}, ${formatNumber(VARIANT.b)}], y₀ = ${formatNumber(VARIANT.y0)}`;
  document.querySelector("#stabilityText").textContent = `max |fᵧ| ≈ ${formatNumber(plan.maxFy)}, N = ${plan.baseN}`;
  document.querySelector("#baseChartMeta").textContent = `N = ${plan.baseN}, h = ${formatNumber(plan.baseH)}`;
  document.querySelector("#doubleChartMeta").textContent = `N = ${plan.doubleN}, h = ${formatNumber(plan.doubleH)}`;
  document.querySelector("#tableMeta").textContent = `Corrector: ${formatNumber(Number(document.querySelector("#iterationInput").value) || 1, 0)} iter.`;
}

function renderTables({ cases }) {
  const { formatNumber } = window.LabMath;
  const metricsBody = document.querySelector("#metricsBody");
  metricsBody.innerHTML = "";
  for (const item of cases) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.label}</td>
      <td>${item.n}</td>
      <td>${formatNumber(item.h)}</td>
      <td>${formatNumber(item.finalY)}</td>
      <td>${formatNumber(item.finalExact)}</td>
      <td>${formatNumber(item.finalError)}</td>
      <td>${formatNumber(item.maxError)}</td>
      <td>${formatNumber(item.maxGap)}</td>
    `;
    metricsBody.append(row);
  }

  const baseControlled = cases.find((item) => item.key === "baseControlled");
  const nodesBody = document.querySelector("#nodesBody");
  nodesBody.innerHTML = "";
  baseControlled.t.forEach((t, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i}</td>
      <td>${formatNumber(t)}</td>
      <td>${formatNumber(baseControlled.p[i])}</td>
      <td>${formatNumber(baseControlled.y[i])}</td>
      <td>${formatNumber(baseControlled.exact[i])}</td>
      <td>${formatNumber(baseControlled.errors[i])}</td>
    `;
    nodesBody.append(row);
  });
}

function download(type) {
  const { VARIANT } = window.LabMath;
  const { CASE_STYLES } = window.LabCharts;
  if (!appState.results) return;
  const { plan, cases } = appState.results;
  let blob;
  let filename;

  if (type === "json") {
    blob = new Blob([JSON.stringify(appState.results, stripFunctions, 2)], { type: "application/json" });
    filename = `lab7-variant-${VARIANT.id}.json`;
  } else {
    const lines = ["variant,method,case,N,h,i,t,p,y,exact,error,gap"];
    for (const item of cases) {
      item.t.forEach((t, i) => {
        lines.push([
          VARIANT.id,
          VARIANT.method,
          item.label,
          item.n,
          item.h,
          i,
          t,
          item.p[i],
          item.y[i],
          item.exact[i],
          item.errors[i],
          item.gaps[i],
        ].join(","));
      });
    }
    lines.push(`# hLimit,${plan.hLimit}`);
    lines.push(`# seriesColors,${JSON.stringify(CASE_STYLES)}`);
    blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    filename = `lab7-variant-${VARIANT.id}.csv`;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function stripFunctions(key, value) {
  return typeof value === "function" ? undefined : value;
}

function init() {
  setupControls();
  render();
}

window.LabApp = {
  init,
};
