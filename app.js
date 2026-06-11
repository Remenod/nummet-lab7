const METHOD_LABELS = {
  adams: "Adams-Bashforth-Moulton",
  milne: "Milne-Simpson",
  hamming: "Hamming",
};

const METHOD_LIMITS = {
  adams: 0.75,
  milne: 0.45,
  hamming: 0.69,
};

const CONTROLLER_COEFFICIENTS = {
  adams: -19 / 270,
  milne: 28 / 29,
  hamming: 9 / 121,
};

const VARIANT_PATTERNS = {
  polyMinusY: {
    equation: "y' = t² - y, y(0) = 1",
    exactLabel: "y(t) = -e⁻ᵗ + t² - 2t + 2",
    a: 0,
    b: 5,
    y0: 1,
    f: (t, y) => t * t - y,
    exact: (t) => -Math.exp(-t) + t * t - 2 * t + 2,
    fy: () => 1,
  },
  growth: {
    equation: "y' = y + 3t - t², y(0) = 1",
    exactLabel: "y(t) = 2eᵗ + t² - t - 1",
    a: 0,
    b: 5,
    y0: 1,
    f: (t, y) => y + 3 * t - t * t,
    exact: (t) => 2 * Math.exp(t) + t * t - t - 1,
    fy: () => 1,
  },
  inverse: {
    equation: "y' = -t / y, y(1) = 1",
    exactLabel: "y(t) = √(2 - t²)",
    a: 1,
    b: 1.5,
    y0: 1,
    f: (t, y) => -t / y,
    exact: (t) => Math.sqrt(2 - t * t),
    fy: (t, y) => Math.abs(t / (y * y)),
  },
  nonlinear: {
    equation: "y' = 2t y², y(0) = 1",
    exactLabel: "y(t) = 1 / (1 - t²)",
    a: 0,
    b: 0.9,
    y0: 1,
    f: (t, y) => 2 * t * y * y,
    exact: (t) => 1 / (1 - t * t),
    fy: (t, y) => Math.abs(4 * t * y),
  },
};

const VARIANTS = [
  makeVariant(1, "adams", "polyMinusY"),
  makeVariant(2, "hamming", "growth"),
  makeVariant(3, "milne", "growth"),
  makeVariant(4, "adams", "inverse"),
  makeVariant(5, "hamming", "polyMinusY"),
  makeVariant(6, "adams", "growth"),
  makeVariant(7, "hamming", "nonlinear"),
  makeVariant(8, "milne", "polyMinusY"),
  makeVariant(9, "adams", "nonlinear"),
  makeVariant(10, "hamming", "inverse"),
  makeVariant(11, "milne", "polyMinusY"),
  makeVariant(12, "adams", "nonlinear"),
  makeVariant(13, "hamming", "growth"),
  makeVariant(14, "milne", "inverse"),
  makeVariant(15, "adams", "inverse"),
  makeVariant(16, "hamming", "growth"),
  makeVariant(17, "milne", "polyMinusY"),
  makeVariant(18, "adams", "inverse"),
  makeVariant(19, "hamming", "growth"),
  makeVariant(20, "milne", "inverse"),
];

const COLORS = {
  exact: "#172121",
  plain: "#b64620",
  controlled: "#00736d",
  doubledPlain: "#836600",
  doubledControlled: "#63518f",
};

const state = {
  results: null,
  charts: [],
};

function makeVariant(id, method, patternKey) {
  return {
    id,
    method,
    ...VARIANT_PATTERNS[patternKey],
  };
}

function rk4Step(f, t, y, h) {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, y + (h * k1) / 2);
  const k3 = f(t + h / 2, y + (h * k2) / 2);
  const k4 = f(t + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

function estimateMaxFy(variant) {
  let maxValue = 0;
  const samples = 600;
  for (let i = 0; i <= samples; i += 1) {
    const t = variant.a + ((variant.b - variant.a) * i) / samples;
    const y = variant.exact(t);
    const value = Math.abs(variant.fy(t, y));
    if (Number.isFinite(value)) {
      maxValue = Math.max(maxValue, value);
    }
  }
  return maxValue || 1;
}

function makeStepPlan(variant) {
  const maxFy = estimateMaxFy(variant);
  const hLimit = METHOD_LIMITS[variant.method] / maxFy;
  const length = variant.b - variant.a;
  const baseN = Math.max(4, Math.ceil(length / hLimit));
  const doubleN = Math.max(4, Math.floor(baseN / 2));
  return {
    maxFy,
    hLimit,
    baseN,
    baseH: length / baseN,
    doubleN,
    doubleH: length / doubleN,
  };
}

function predictor(method, h, y, f, k) {
  if (method === "adams") {
    return y[k] + (h / 24) * (-9 * f[k - 3] + 37 * f[k - 2] - 59 * f[k - 1] + 55 * f[k]);
  }
  return y[k - 3] + (4 * h / 3) * (2 * f[k - 2] - f[k - 1] + 2 * f[k]);
}

function corrector(method, variant, h, tNext, driver, y, f, k) {
  const fNext = variant.f(tNext, driver);
  if (method === "adams") {
    return y[k] + (h / 24) * (f[k - 2] - 5 * f[k - 1] + 19 * f[k] + 9 * fNext);
  }
  if (method === "milne") {
    return y[k - 1] + (h / 3) * (f[k - 1] + 4 * f[k] + fNext);
  }
  return (-y[k - 2] + 9 * y[k]) / 8 + (3 * h / 8) * (-f[k - 1] + 2 * f[k] + fNext);
}

function solveCase(variant, options) {
  const { n, controlled, iterations, label, key } = options;
  const h = (variant.b - variant.a) / n;
  const t = Array.from({ length: n + 1 }, (_, i) => variant.a + i * h);
  const y = Array(n + 1).fill(Number.NaN);
  const p = Array(n + 1).fill(Number.NaN);
  const fValues = Array(n + 1).fill(Number.NaN);
  const exact = Array(n + 1).fill(Number.NaN);
  const errors = Array(n + 1).fill(Number.NaN);
  const gaps = Array(n + 1).fill(Number.NaN);

  y[0] = variant.y0;
  fValues[0] = variant.f(t[0], y[0]);

  for (let i = 1; i <= Math.min(3, n); i += 1) {
    y[i] = rk4Step(variant.f, t[i - 1], y[i - 1], h);
    fValues[i] = variant.f(t[i], y[i]);
  }

  for (let k = 3; k < n; k += 1) {
    const tNext = t[k + 1];
    const pNext = predictor(variant.method, h, y, fValues, k);
    const previousGap = Number.isFinite(p[k]) ? y[k] - p[k] : 0;
    let driver = controlled ? pNext + CONTROLLER_COEFFICIENTS[variant.method] * previousGap : pNext;
    let yNext = corrector(variant.method, variant, h, tNext, driver, y, fValues, k);

    for (let pass = 1; pass < iterations; pass += 1) {
      yNext = corrector(variant.method, variant, h, tNext, yNext, y, fValues, k);
    }

    p[k + 1] = pNext;
    y[k + 1] = yNext;
    fValues[k + 1] = variant.f(tNext, yNext);
    gaps[k + 1] = Math.abs(yNext - pNext);
  }

  for (let i = 0; i <= n; i += 1) {
    exact[i] = variant.exact(t[i]);
    if (Number.isFinite(exact[i]) && Number.isFinite(y[i])) {
      errors[i] = Math.abs(y[i] - exact[i]);
    }
  }

  const finiteErrors = errors.filter(Number.isFinite);
  const finiteGaps = gaps.filter(Number.isFinite);
  const finalExact = exact[n];
  const finalError = Number.isFinite(finalExact) ? Math.abs(y[n] - finalExact) : Number.NaN;

  return {
    key,
    label,
    n,
    h,
    controlled,
    t,
    y,
    p,
    exact,
    errors,
    gaps,
    finalY: y[n],
    finalExact,
    finalError,
    maxError: finiteErrors.length ? Math.max(...finiteErrors) : Number.NaN,
    rmse: finiteErrors.length
      ? Math.sqrt(finiteErrors.reduce((sum, value) => sum + value * value, 0) / finiteErrors.length)
      : Number.NaN,
    maxGap: finiteGaps.length ? Math.max(...finiteGaps) : Number.NaN,
  };
}

function computeAll(variant, iterations) {
  const plan = makeStepPlan(variant);
  const cases = [
    solveCase(variant, {
      n: plan.baseN,
      controlled: false,
      iterations,
      key: "basePlain",
      label: "a) without control parameter",
    }),
    solveCase(variant, {
      n: plan.baseN,
      controlled: true,
      iterations,
      key: "baseControlled",
      label: "b) with control parameter",
    }),
    solveCase(variant, {
      n: plan.doubleN,
      controlled: false,
      iterations,
      key: "doublePlain",
      label: "c) 2h without control parameter",
    }),
    solveCase(variant, {
      n: plan.doubleN,
      controlled: true,
      iterations,
      key: "doubleControlled",
      label: "d) 2h with control parameter",
    }),
  ];
  return { variant, plan, cases };
}

function formatNumber(value, digits = 6) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if ((abs > 0 && abs < 0.001) || abs >= 100000) {
    return value.toExponential(4);
  }
  return value.toLocaleString("uk-UA", {
    maximumFractionDigits: digits,
    minimumFractionDigits: abs < 10 ? Math.min(3, digits) : 0,
  });
}

function setupControls() {
  const select = document.querySelector("#variantSelect");
  for (const variant of VARIANTS) {
    const option = document.createElement("option");
    option.value = String(variant.id);
    option.textContent = `Variant ${variant.id}: ${METHOD_LABELS[variant.method]} — ${variant.equation}`;
    select.append(option);
  }
  select.value = "9";

  select.addEventListener("change", render);
  document.querySelector("#iterationInput").addEventListener("input", render);
  document.querySelector("#markersToggle").addEventListener("change", renderChartsOnly);
  document.querySelector("#csvButton").addEventListener("click", () => download("csv"));
  document.querySelector("#jsonButton").addEventListener("click", () => download("json"));
  window.addEventListener("resize", () => renderChartsOnly());
}

function render() {
  const variantId = Number(document.querySelector("#variantSelect").value);
  const iterations = Math.max(1, Math.min(6, Number(document.querySelector("#iterationInput").value) || 1));
  const variant = VARIANTS.find((item) => item.id === variantId) || VARIANTS[8];
  state.results = computeAll(variant, iterations);

  renderSummary(state.results);
  renderTables(state.results);
  renderChartsOnly();
  document.querySelector("#statusText").textContent = `Variant ${variant.id}`;
}

function renderSummary({ variant, plan, cases }) {
  const best = [...cases]
    .filter((item) => Number.isFinite(item.maxError))
    .sort((a, b) => a.maxError - b.maxError)[0];

  document.querySelector("#methodMetric").textContent = METHOD_LABELS[variant.method];
  document.querySelector("#limitMetric").textContent = `h ≤ ${formatNumber(plan.hLimit)}`;
  document.querySelector("#stepsMetric").textContent = `${formatNumber(plan.baseH)} / ${formatNumber(plan.doubleH)}`;
  document.querySelector("#bestMetric").textContent = best ? best.label.replace(/^[a-d]\)\s*/, "") : "—";
  document.querySelector("#variantTitle").textContent = `Variant ${variant.id}: ${METHOD_LABELS[variant.method]}`;
  document.querySelector("#variantFormula").textContent = variant.equation;
  document.querySelector("#exactFormula").textContent = variant.exactLabel;
  document.querySelector("#intervalText").textContent = `[${formatNumber(variant.a)}, ${formatNumber(variant.b)}], y₀ = ${formatNumber(variant.y0)}`;
  document.querySelector("#stabilityText").textContent = `max |fᵧ| ≈ ${formatNumber(plan.maxFy)}, N = ${plan.baseN}`;
  document.querySelector("#baseChartMeta").textContent = `N = ${plan.baseN}, h = ${formatNumber(plan.baseH)}`;
  document.querySelector("#doubleChartMeta").textContent = `N = ${plan.doubleN}, h = ${formatNumber(plan.doubleH)}`;
  document.querySelector("#tableMeta").textContent = `Corrector: ${formatNumber(Number(document.querySelector("#iterationInput").value) || 1, 0)} iter.`;
}

function renderTables({ cases }) {
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

function renderChartsOnly() {
  if (!state.results) return;
  const { cases } = state.results;
  const showMarkers = document.querySelector("#markersToggle").checked;
  const basePlain = cases.find((item) => item.key === "basePlain");
  const baseControlled = cases.find((item) => item.key === "baseControlled");
  const doublePlain = cases.find((item) => item.key === "doublePlain");
  const doubleControlled = cases.find((item) => item.key === "doubleControlled");

  drawChart(document.querySelector("#baseChart"), [
    makeDataset("Exact solution", basePlain.t, basePlain.exact, COLORS.exact, []),
    makeDataset("a) without control parameter", basePlain.t, basePlain.y, COLORS.plain, [8, 5]),
    makeDataset("b) with control parameter", baseControlled.t, baseControlled.y, COLORS.controlled, [10, 4, 2, 4]),
  ], showMarkers);
  drawLegend("#baseLegend", [
    ["Exact solution", COLORS.exact],
    ["a) without control parameter", COLORS.plain],
    ["b) with control parameter", COLORS.controlled],
  ]);

  drawChart(document.querySelector("#doubleChart"), [
    makeDataset("Exact solution", doublePlain.t, doublePlain.exact, COLORS.exact, []),
    makeDataset("c) 2h without control parameter", doublePlain.t, doublePlain.y, COLORS.doubledPlain, [8, 5]),
    makeDataset("d) 2h with control parameter", doubleControlled.t, doubleControlled.y, COLORS.doubledControlled, [10, 4, 2, 4]),
  ], showMarkers);
  drawLegend("#doubleLegend", [
    ["Exact solution", COLORS.exact],
    ["c) 2h without control parameter", COLORS.doubledPlain],
    ["d) 2h with control parameter", COLORS.doubledControlled],
  ]);
}

function makeDataset(label, x, y, color, dash) {
  return { label, x, y, color, dash };
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

function drawChart(canvas, datasets, showMarkers) {
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
  const yPad = Math.max((yMax - yMin) * 0.08, 0.5);
  yMin -= yPad;
  yMax += yPad;

  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xScale = (value) => pad.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (value) => pad.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotHeight;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, pad, xMin, xMax, yMin, yMax, xScale, yScale);

  for (const dataset of datasets) {
    ctx.save();
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = dataset.label.startsWith("Exact") ? 2.4 : 2;
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

    if (showMarkers && !dataset.label.startsWith("Exact")) {
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
}

function drawGrid(ctx, width, height, pad, xMin, xMax, yMin, yMax, xScale, yScale) {
  ctx.save();
  ctx.strokeStyle = "#d9e1de";
  ctx.fillStyle = "#5e6765";
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "middle";

  const ticks = 5;
  for (let i = 0; i <= ticks; i += 1) {
    const xValue = xMin + ((xMax - xMin) * i) / ticks;
    const x = xScale(xValue);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(xValue, 3), x, height - 20);
  }

  for (let i = 0; i <= ticks; i += 1) {
    const yValue = yMin + ((yMax - yMin) * i) / ticks;
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

function download(type) {
  if (!state.results) return;
  const { variant, plan, cases } = state.results;
  let blob;
  let filename;

  if (type === "json") {
    blob = new Blob([JSON.stringify(state.results, stripFunctions, 2)], { type: "application/json" });
    filename = `lab7-variant-${variant.id}.json`;
  } else {
    const lines = ["variant,method,case,N,h,i,t,p,y,exact,error,gap"];
    for (const item of cases) {
      item.t.forEach((t, i) => {
        lines.push([
          variant.id,
          METHOD_LABELS[variant.method],
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
    blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    filename = `lab7-variant-${variant.id}.csv`;
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

setupControls();
render();
