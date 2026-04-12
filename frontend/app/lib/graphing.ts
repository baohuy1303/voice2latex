export interface GraphViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface GraphFunction {
  id: string;
  expression: string;
  displayExpression: string;
  color: string;
}

export interface GraphRenderData {
  functions: Array<{
    id: string;
    displayExpression: string;
    color: string;
    pathData: string[];
  }>;
  xAxisY: number;
  yAxisX: number;
  xTicks: number[];
  yTicks: number[];
  xTickPositions: number[];
  yTickPositions: number[];
}

export const DEFAULT_GRAPH_VIEWPORT: GraphViewport = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
};

const SAMPLE_COUNT = 320;
const SVG_SIZE = 100;
const GRAPH_COLORS = [
  "#60a5fa",
  "#f59e0b",
  "#34d399",
  "#f472b6",
  "#a78bfa",
  "#f87171",
];

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

function toSvgX(x: number, viewport: GraphViewport): number {
  return ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * SVG_SIZE;
}

function toSvgY(y: number, viewport: GraphViewport): number {
  return SVG_SIZE - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * SVG_SIZE;
}

function formatTick(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeExpression(rawInput: string): { expression: string; displayExpression: string } {
  let input = rawInput.trim();
  if (!input) {
    throw new Error("Enter an expression like y = x^2 or y = sin(x).");
  }

  input = input
    .replace(/\$+/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\u2212/g, "-")
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

function buildTicks(min: number, max: number): number[] {
  const step = (max - min) / 4;
  return Array.from({ length: 5 }, (_, index) => formatTick(min + step * index));
}

function splitGraphExpressions(raw: string): string[] {
  return raw
    .split(/\s+and\s+|;/i)
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}

function scoreGraphCandidate(candidate: string): number {
  const trimmed = candidate.trim();
  let score = 0;

  if (/^y\s*=/.test(trimmed)) score += 12;
  if (/^\$+.*y\s*=/.test(trimmed)) score += 10;
  if (/\\sin|\\cos|\\tan|sin\(|cos\(|tan\(/i.test(trimmed)) score += 3;
  if (/x/.test(trimmed)) score += 2;
  if (trimmed.length > 48) score -= 2;
  if (/\\begin|\\int|\\sum|\\prod|\\matrix|\\cases/i.test(trimmed)) score -= 5;
  if (/[<>]/.test(trimmed)) score -= 2;

  return score;
}

function buildPathData(expression: string, viewport: GraphViewport): string[] {
  const evaluate = compileExpression(expression);
  const segments: string[] = [];
  let currentSegment: string[] = [];
  const yLimit = Math.max(Math.abs(viewport.yMin), Math.abs(viewport.yMax)) * 3;

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = viewport.xMin + ((viewport.xMax - viewport.xMin) * index) / SAMPLE_COUNT;
    let y: number;

    try {
      y = evaluate(x);
    } catch {
      if (currentSegment.length > 1) segments.push(currentSegment.join(" "));
      currentSegment = [];
      continue;
    }

    if (!Number.isFinite(y) || Math.abs(y) > yLimit) {
      if (currentSegment.length > 1) segments.push(currentSegment.join(" "));
      currentSegment = [];
      continue;
    }

    currentSegment.push(
      `${currentSegment.length === 0 ? "M" : "L"} ${toSvgX(x, viewport).toFixed(2)} ${toSvgY(y, viewport).toFixed(2)}`
    );
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment.join(" "));
  }

  if (segments.length === 0) {
    throw new Error("That function has too many undefined regions to render cleanly.");
  }

  return segments;
}

export function createGraphFunction(rawInput: string, index: number): GraphFunction {
  const { expression, displayExpression } = normalizeExpression(rawInput);
  return {
    id: `${expression}-${index}-${Date.now()}`,
    expression,
    displayExpression,
    color: GRAPH_COLORS[index % GRAPH_COLORS.length],
  };
}

export function buildGraphData(functions: GraphFunction[], viewport: GraphViewport): GraphRenderData {
  if (functions.length === 0) {
    throw new Error("Add a function to graph.");
  }

  return {
    functions: functions.map((graphFn) => ({
      id: graphFn.id,
      displayExpression: graphFn.displayExpression,
      color: graphFn.color,
      pathData: buildPathData(graphFn.expression, viewport),
    })),
    xAxisY: toSvgY(0, viewport),
    yAxisX: toSvgX(0, viewport),
    xTicks: buildTicks(viewport.xMin, viewport.xMax),
    yTicks: buildTicks(viewport.yMin, viewport.yMax),
    xTickPositions: buildTicks(viewport.xMin, viewport.xMax).map((tick) => toSvgX(tick, viewport)),
    yTickPositions: buildTicks(viewport.yMin, viewport.yMax).map((tick) => toSvgY(tick, viewport)),
  };
}

export function extractGraphExpression(document: string): string | null {
  return extractPrimaryGraphExpression(document);
}

export function extractGraphExpressions(document: string): string[] {
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

  const seen = new Set<string>();
  const graphable: string[] = [];

  for (const candidate of candidates) {
    try {
      const { displayExpression } = normalizeExpression(candidate);
      if (!seen.has(displayExpression)) {
        seen.add(displayExpression);
        graphable.push(candidate);
      }
    } catch {
      continue;
    }
  }

  return graphable.sort((a, b) => scoreGraphCandidate(b) - scoreGraphCandidate(a));
}

export function extractPrimaryGraphExpression(document: string): string | null {
  const candidates = extractGraphExpressions(document);
  return candidates[0] ?? null;
}

export function getGraphCommandExpressions(message: string, document: string): string[] | null {
  const match = message.match(/^graph(?:\s+(.*))?$/i);
  if (!match) return null;

  const requested = match[1]?.trim();
  if (!requested || /^(this|current|current expression|current equation)$/i.test(requested)) {
    return extractGraphExpressions(document);
  }

  const expressions = splitGraphExpressions(requested);
  return expressions.length > 0 ? expressions : null;
}

export function getShiftedViewport(
  viewport: GraphViewport,
  direction: "left" | "right" | "up" | "down"
): GraphViewport {
  const dx = (viewport.xMax - viewport.xMin) * 0.18;
  const dy = (viewport.yMax - viewport.yMin) * 0.18;

  switch (direction) {
    case "left":
      return { ...viewport, xMin: viewport.xMin - dx, xMax: viewport.xMax - dx };
    case "right":
      return { ...viewport, xMin: viewport.xMin + dx, xMax: viewport.xMax + dx };
    case "up":
      return { ...viewport, yMin: viewport.yMin + dy, yMax: viewport.yMax + dy };
    case "down":
      return { ...viewport, yMin: viewport.yMin - dy, yMax: viewport.yMax - dy };
  }
}

export function getZoomedViewport(viewport: GraphViewport, factor: number): GraphViewport {
  const centerX = (viewport.xMin + viewport.xMax) / 2;
  const centerY = (viewport.yMin + viewport.yMax) / 2;
  const halfWidth = ((viewport.xMax - viewport.xMin) * factor) / 2;
  const halfHeight = ((viewport.yMax - viewport.yMin) * factor) / 2;

  return {
    xMin: centerX - halfWidth,
    xMax: centerX + halfWidth,
    yMin: centerY - halfHeight,
    yMax: centerY + halfHeight,
  };
}
