export interface GraphRenderData {
  expression: string;
  displayExpression: string;
  pathData: string[];
  xAxisY: number;
  yAxisX: number;
  xTicks: number[];
  yTicks: number[];
  yTickPositions: number[];
}

const GRAPH_DOMAIN = { min: -4, max: 4 };
const SAMPLE_COUNT = 240;
const SVG_SIZE = 100;
const SUPPORTED_IDENTIFIERS = new Set([
  "x",
  "sin",
  "cos",
  "tan",
  "log",
  "ln",
  "sqrt",
  "abs",
  "exp",
  "PI",
  "E",
]);

function formatTick(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

function toSvgX(x: number): number {
  return ((x - GRAPH_DOMAIN.min) / (GRAPH_DOMAIN.max - GRAPH_DOMAIN.min)) * SVG_SIZE;
}

function toSvgY(y: number, minY: number, maxY: number): number {
  return SVG_SIZE - ((y - minY) / (maxY - minY)) * SVG_SIZE;
}

function normalizeExpression(rawInput: string): { expression: string; displayExpression: string } {
  let input = rawInput.trim();
  if (!input) {
    throw new Error("Enter an expression like y = x^2 or y = sin(x).");
  }

  input = input
    .replace(/\$+/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/−/g, "-")
    .replace(/\\cdot|\\times/g, "*");

  while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(input)) {
    input = input.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(($1)/($2))");
  }

  input = input
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\sqrt/g, "sqrt")
    .replace(/\\ln/g, "ln")
    .replace(/\\log/g, "log")
    .replace(/\\pi/g, "PI")
    .replace(/{/g, "(")
    .replace(/}/g, ")")
    .replace(/\)\(/g, ")*(");

  const equalsIndex = input.indexOf("=");
  if (equalsIndex !== -1) {
    const lhs = input.slice(0, equalsIndex).trim().toLowerCase();
    if (lhs !== "y") {
      throw new Error("Only simple y = f(x) graphs are supported right now.");
    }
    input = input.slice(equalsIndex + 1);
  }

  let expression = input.replace(/\s+/g, "");
  expression = expression
    .replace(/\^/g, "**")
    .replace(/(\d)([A-Za-z(])/g, "$1*$2")
    .replace(/([xEPI)])(\d|\()/g, "$1*$2")
    .replace(/(x)([A-Za-z])/g, "$1*$2")
    .replace(/(\))([A-Za-z])/g, "$1*$2")
    .replace(/\bln\(/g, "log(");

  if (!/[xX]/.test(expression)) {
    throw new Error("That expression does not look like a function of x.");
  }

  if (!/^[0-9A-Za-z+\-*/^().,]*$/.test(expression)) {
    throw new Error("Only basic arithmetic and common functions are supported.");
  }

  const identifiers = expression.match(/[A-Za-z_]+/g) ?? [];
  for (const identifier of identifiers) {
    if (!SUPPORTED_IDENTIFIERS.has(identifier)) {
      throw new Error(`Unsupported token "${identifier}". Try sin, cos, tan, sqrt, log, or abs.`);
    }
  }

  return {
    expression,
    displayExpression: `y = ${input.trim()}`,
  };
}

function compileExpression(expression: string): (x: number) => number {
  const evaluator = new Function(
    "x",
    "sin",
    "cos",
    "tan",
    "log",
    "sqrt",
    "abs",
    "exp",
    "PI",
    "E",
    `return ${expression};`
  ) as (
    x: number,
    sin: typeof Math.sin,
    cos: typeof Math.cos,
    tan: typeof Math.tan,
    log: typeof Math.log,
    sqrt: typeof Math.sqrt,
    abs: typeof Math.abs,
    exp: typeof Math.exp,
    PI: number,
    E: number
  ) => number;

  return (x: number) =>
    evaluator(x, Math.sin, Math.cos, Math.tan, Math.log, Math.sqrt, Math.abs, Math.exp, Math.PI, Math.E);
}

export function buildGraphData(rawInput: string): GraphRenderData {
  const { expression, displayExpression } = normalizeExpression(rawInput);
  const evaluate = compileExpression(expression);

  const samples: Array<{ x: number; y: number } | null> = [];
  const boundedValues: number[] = [];

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = GRAPH_DOMAIN.min + ((GRAPH_DOMAIN.max - GRAPH_DOMAIN.min) * index) / SAMPLE_COUNT;
    let y: number;

    try {
      y = evaluate(x);
    } catch {
      samples.push(null);
      continue;
    }

    if (!Number.isFinite(y)) {
      samples.push(null);
      continue;
    }

    samples.push({ x, y });

    if (Math.abs(y) <= 100) {
      boundedValues.push(Math.abs(y));
    }
  }

  const validPoints = samples.filter((point): point is { x: number; y: number } => point !== null);
  if (validPoints.length < 8) {
    throw new Error("I couldn't sample enough valid points to draw that graph.");
  }

  const yBound = Math.max(4, percentile(boundedValues.length > 0 ? boundedValues : validPoints.map((point) => Math.abs(point.y)), 0.9) * 1.25);
  const minY = -yBound;
  const maxY = yBound;

  const segments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];

  for (const point of samples) {
    if (!point || Math.abs(point.y) > yBound * 2.5) {
      if (currentSegment.length > 1) segments.push(currentSegment);
      currentSegment = [];
      continue;
    }

    currentSegment.push(point);
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  if (segments.length === 0) {
    throw new Error("That function has too many undefined regions to render cleanly.");
  }

  const pathData = segments.map((segment) =>
    segment
      .map((point, index) => `${index === 0 ? "M" : "L"} ${toSvgX(point.x).toFixed(2)} ${toSvgY(point.y, minY, maxY).toFixed(2)}`)
      .join(" ")
  );

  return {
    expression,
    displayExpression,
    pathData,
    xAxisY: toSvgY(0, minY, maxY),
    yAxisX: toSvgX(0),
    xTicks: [-4, -2, 0, 2, 4],
    yTicks: [formatTick(maxY), formatTick(maxY / 2), 0, formatTick(-maxY / 2), formatTick(-maxY)],
    yTickPositions: [
      toSvgY(maxY, minY, maxY),
      toSvgY(maxY / 2, minY, maxY),
      toSvgY(0, minY, maxY),
      toSvgY(-maxY / 2, minY, maxY),
      toSvgY(-maxY, minY, maxY),
    ],
  };
}

export function extractGraphExpression(document: string): string | null {
  const candidates: string[] = [];
  const mathBlocks = document.match(/\$\$[\s\S]+?\$\$|\$[^$]+\$/g) ?? [];

  for (const block of mathBlocks) {
    candidates.push(block.replace(/\$+/g, "").trim());
  }

  for (const line of document.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) {
      candidates.push(trimmed);
    }
  }

  for (const candidate of candidates) {
    try {
      buildGraphData(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export function getGraphCommandExpression(message: string, document: string): string | null {
  const match = message.match(/^graph(?:\s+(.*))?$/i);
  if (!match) return null;

  const requested = match[1]?.trim();
  if (!requested || /^(this|current|current expression|current equation)$/i.test(requested)) {
    return extractGraphExpression(document);
  }

  return requested;
}
