const VARIANT = {
  id: 9,
  method: "Adams-Bashforth-Moulton",
  equation: "y' = 2t y², y(0) = 1",
  exactLabel: "y(t) = 1 / (1 - t²)",
  a: 0,
  b: 0.9,
  y0: 1,
  stabilityConstant: 0.75,
  f: (t, y) => 2 * t * y * y,
  exact: (t) => 1 / (1 - t * t),
  fy: (t, y) => Math.abs(4 * t * y),
};

const CASE_DEFINITIONS = [
  {
    key: "basePlain",
    chart: "base",
    label: "a) without control parameter",
    stepMode: "base",
    controlled: false,
  },
  {
    key: "baseControlled",
    chart: "base",
    label: "b) with control parameter",
    stepMode: "base",
    controlled: true,
  },
  {
    key: "doublePlain",
    chart: "double",
    label: "c) 2h without control parameter",
    stepMode: "double",
    controlled: false,
  },
  {
    key: "doubleControlled",
    chart: "double",
    label: "d) 2h with control parameter",
    stepMode: "double",
    controlled: true,
  },
];

// RK4 is used only to bootstrap the first three nodes required by the multistep formula.
function rk4Step(t, y, h) {
  const k1 = VARIANT.f(t, y);
  const k2 = VARIANT.f(t + h / 2, y + (h * k1) / 2);
  const k3 = VARIANT.f(t + h / 2, y + (h * k2) / 2);
  const k4 = VARIANT.f(t + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

function estimateMaxFy() {
  let maxValue = 0;
  const samples = 1200;
  for (let i = 0; i <= samples; i += 1) {
    const t = VARIANT.a + ((VARIANT.b - VARIANT.a) * i) / samples;
    const y = VARIANT.exact(t);
    const value = VARIANT.fy(t, y);
    if (Number.isFinite(value)) maxValue = Math.max(maxValue, value);
  }
  return maxValue || 1;
}

// Stability rule from the lab: h < 0.75 / max |df/dy| for Adams-Bashforth-Moulton.
function makeStepPlan() {
  const maxFy = estimateMaxFy();
  const hLimit = VARIANT.stabilityConstant / maxFy;
  const length = VARIANT.b - VARIANT.a;
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

function adamsPredictor(h, y, fValues, k) {
  return y[k] + (h / 24) * (-9 * fValues[k - 3] + 37 * fValues[k - 2] - 59 * fValues[k - 1] + 55 * fValues[k]);
}

function adamsCorrector(h, tNext, driver, y, fValues, k) {
  const fNext = VARIANT.f(tNext, driver);
  return y[k] + (h / 24) * (fValues[k - 2] - 5 * fValues[k - 1] + 19 * fValues[k] + 9 * fNext);
}

function solveCase(config, n, iterations) {
  const h = (VARIANT.b - VARIANT.a) / n;
  const t = Array.from({ length: n + 1 }, (_, i) => VARIANT.a + i * h);
  const y = Array(n + 1).fill(Number.NaN);
  const p = Array(n + 1).fill(Number.NaN);
  const fValues = Array(n + 1).fill(Number.NaN);
  const exact = Array(n + 1).fill(Number.NaN);
  const errors = Array(n + 1).fill(Number.NaN);
  const gaps = Array(n + 1).fill(Number.NaN);

  y[0] = VARIANT.y0;
  fValues[0] = VARIANT.f(t[0], y[0]);

  for (let i = 1; i <= Math.min(3, n); i += 1) {
    y[i] = rk4Step(t[i - 1], y[i - 1], h);
    fValues[i] = VARIANT.f(t[i], y[i]);
  }

  // From p4 onward: Adams predictor -> optional controller -> Adams-Moulton corrector.
  for (let k = 3; k < n; k += 1) {
    const tNext = t[k + 1];
    const pNext = adamsPredictor(h, y, fValues, k);
    const previousGap = Number.isFinite(p[k]) ? y[k] - p[k] : 0;
    const driver = config.controlled ? pNext - (19 * previousGap) / 270 : pNext;
    let yNext = adamsCorrector(h, tNext, driver, y, fValues, k);

    for (let pass = 1; pass < iterations; pass += 1) {
      yNext = adamsCorrector(h, tNext, yNext, y, fValues, k);
    }

    p[k + 1] = pNext;
    y[k + 1] = yNext;
    fValues[k + 1] = VARIANT.f(tNext, yNext);
    gaps[k + 1] = Math.abs(yNext - pNext);
  }

  for (let i = 0; i <= n; i += 1) {
    exact[i] = VARIANT.exact(t[i]);
    errors[i] = Math.abs(y[i] - exact[i]);
  }

  const finiteErrors = errors.filter(Number.isFinite);
  const finiteGaps = gaps.filter(Number.isFinite);
  return {
    ...config,
    n,
    h,
    t,
    y,
    p,
    exact,
    errors,
    gaps,
    finalY: y[n],
    finalExact: exact[n],
    finalError: Math.abs(y[n] - exact[n]),
    maxError: Math.max(...finiteErrors),
    rmse: Math.sqrt(finiteErrors.reduce((sum, value) => sum + value * value, 0) / finiteErrors.length),
    maxGap: finiteGaps.length ? Math.max(...finiteGaps) : Number.NaN,
  };
}

function computeAll(iterations) {
  const plan = makeStepPlan();
  const cases = CASE_DEFINITIONS.map((config) => {
    const n = config.stepMode === "base" ? plan.baseN : plan.doubleN;
    return solveCase(config, n, iterations);
  });
  return { variant: VARIANT, plan, cases };
}

function formatNumber(value, digits = 6) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if ((abs > 0 && abs < 0.001) || abs >= 100000) return value.toExponential(4);
  return value.toLocaleString("uk-UA", {
    maximumFractionDigits: digits,
    minimumFractionDigits: abs < 10 ? Math.min(3, digits) : 0,
  });
}

window.LabMath = {
  VARIANT,
  CASE_DEFINITIONS,
  computeAll,
  formatNumber,
};
