"use client";

import dynamic from "next/dynamic";
import type { Monaco } from "@monaco-editor/react";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-zinc-500">
      Loading editor...
    </div>
  ),
});

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Loading diff viewer...
      </div>
    ),
  }
);

// ─── LaTeX language registration ─────────────────────────────────────────────

let latexRegistered = false;

function registerLatex(monaco: Monaco) {
  if (latexRegistered) return;
  latexRegistered = true;

  monaco.languages.register({ id: "latex" });

  monaco.languages.setMonarchTokensProvider("latex", {
    tokenizer: {
      root: [
        // Comments
        [/%.*$/, "comment"],
        // Display math $$...$$
        [/\$\$/, { token: "math.delim", next: "@displayMath" }],
        // Inline math $...$
        [/\$/, { token: "math.delim", next: "@inlineMath" }],
        // \begin{env} / \end{env}
        [/\\(begin|end)(\{)([^}]*)(\})/, [
          "keyword.env",
          "delimiter.brace",
          "string.env",
          "delimiter.brace",
        ]],
        // \documentclass, \usepackage (preamble commands)
        [/\\(documentclass|usepackage|RequirePackage|LoadClass)\b/, "keyword.preamble"],
        // \section, \subsection, \chapter, \paragraph, \part
        [/\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\b/, "keyword.section"],
        // Generic LaTeX commands: \command or \command*
        [/\\[a-zA-Z]+\*?/, "keyword.command"],
        // Backslash escape (\\) or special (\, \;, etc.)
        [/\\[^a-zA-Z]/, "keyword.special"],
        // Curly braces
        [/[{}]/, "delimiter.brace"],
        // Square brackets
        [/[\[\]]/, "delimiter.bracket"],
        // Alignment & line-break operators
        [/&/, "keyword.operator"],
        // Numbers
        [/\b\d+(\.\d+)?\b/, "number"],
      ],
      inlineMath: [
        [/\$/, { token: "math.delim", next: "@pop" }],
        [/\\[a-zA-Z]+\*?/, "math.command"],
        [/[{}]/, "math.brace"],
        [/[^$\\{}]+/, "math.content"],
      ],
      displayMath: [
        [/\$\$/, { token: "math.delim", next: "@pop" }],
        [/\\[a-zA-Z]+\*?/, "math.command"],
        [/[{}]/, "math.brace"],
        [/[^$\\{}]+/, "math.content"],
      ],
    },
  });

  monaco.editor.defineTheme("latex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      // Comments
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      // Math delimiters $
      { token: "math.delim", foreground: "FF9D4D", fontStyle: "bold" },
      // Math content and commands inside $ ... $
      { token: "math.content", foreground: "DCDCAA" },
      { token: "math.command", foreground: "4FC1FF" },
      { token: "math.brace", foreground: "FFD700" },
      // Environment keywords
      { token: "keyword.env", foreground: "C586C0", fontStyle: "bold" },
      { token: "string.env", foreground: "F08080" },
      // Section headings
      { token: "keyword.section", foreground: "E9C46A", fontStyle: "bold" },
      // Preamble
      { token: "keyword.preamble", foreground: "9CDCFE" },
      // Generic commands
      { token: "keyword.command", foreground: "569CD6" },
      { token: "keyword.special", foreground: "CE9178" },
      { token: "keyword.operator", foreground: "D4D4D4" },
      // Braces & brackets
      { token: "delimiter.brace", foreground: "FFD700" },
      { token: "delimiter.bracket", foreground: "DA70D6" },
      // Numbers
      { token: "number", foreground: "B5CEA8" },
    ],
    colors: {
      "editor.background": "#18181b",
      "editor.lineHighlightBackground": "#27272a80",
      "editorLineNumber.foreground": "#52525b",
      "editorLineNumber.activeForeground": "#a1a1aa",
      "editorCursor.foreground": "#818cf8",
      "editor.selectionBackground": "#4f46e540",
      "editorBracketMatch.background": "#4f46e540",
      "editorBracketMatch.border": "#818cf8",
    },
  });

  // ─── Autocomplete ───────────────────────────────────────────────────────────
  const SNIPPETS: Array<{ label: string; insert: string; detail?: string }> = [
    // Environments
    { label: "\\begin{equation}", insert: "\\begin{equation}\n\t$0\n\\end{equation}", detail: "equation environment" },
    { label: "\\begin{align}", insert: "\\begin{align}\n\t$0\n\\end{align}", detail: "align environment" },
    { label: "\\begin{align*}", insert: "\\begin{align*}\n\t$0\n\\end{align*}", detail: "align* environment" },
    { label: "\\begin{itemize}", insert: "\\begin{itemize}\n\t\\item $0\n\\end{itemize}", detail: "bullet list" },
    { label: "\\begin{enumerate}", insert: "\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}", detail: "numbered list" },
    { label: "\\begin{matrix}", insert: "\\begin{matrix}\n\t$0\n\\end{matrix}", detail: "matrix" },
    { label: "\\begin{pmatrix}", insert: "\\begin{pmatrix}\n\t$0\n\\end{pmatrix}", detail: "( matrix )" },
    { label: "\\begin{bmatrix}", insert: "\\begin{bmatrix}\n\t$0\n\\end{bmatrix}", detail: "[ matrix ]" },
    { label: "\\begin{cases}", insert: "\\begin{cases}\n\t$1 & \\text{if } $2 \\\\\\\\\n\t$3 & \\text{otherwise}\n\\end{cases}", detail: "cases" },
    // Fractions / roots
    { label: "\\frac", insert: "\\frac{$1}{$2}", detail: "fraction" },
    { label: "\\dfrac", insert: "\\dfrac{$1}{$2}", detail: "display fraction" },
    { label: "\\tfrac", insert: "\\tfrac{$1}{$2}", detail: "text fraction" },
    { label: "\\sqrt", insert: "\\sqrt{$1}", detail: "square root" },
    { label: "\\sqrt[n]", insert: "\\sqrt[$1]{$2}", detail: "nth root" },
    // Integrals / sums
    { label: "\\int", insert: "\\int_{$1}^{$2} $3 \\, d$4", detail: "integral" },
    { label: "\\iint", insert: "\\iint_{$1} $2 \\, d$3", detail: "double integral" },
    { label: "\\iiint", insert: "\\iiint_{$1} $2 \\, d$3", detail: "triple integral" },
    { label: "\\oint", insert: "\\oint_{$1} $2 \\, d$3", detail: "contour integral" },
    { label: "\\sum", insert: "\\sum_{$1}^{$2} $3", detail: "summation" },
    { label: "\\prod", insert: "\\prod_{$1}^{$2} $3", detail: "product" },
    { label: "\\lim", insert: "\\lim_{$1 \\to $2} $3", detail: "limit" },
    // Text formatting
    { label: "\\textbf", insert: "\\textbf{$1}", detail: "bold text" },
    { label: "\\textit", insert: "\\textit{$1}", detail: "italic text" },
    { label: "\\emph", insert: "\\emph{$1}", detail: "emphasize" },
    { label: "\\underline", insert: "\\underline{$1}", detail: "underline" },
    { label: "\\text", insert: "\\text{$1}", detail: "text in math mode" },
    // Math operators
    { label: "\\cdot", insert: "\\cdot", detail: "center dot ·" },
    { label: "\\cdots", insert: "\\cdots", detail: "center dots ···" },
    { label: "\\ldots", insert: "\\ldots", detail: "low dots ..." },
    { label: "\\times", insert: "\\times", detail: "times ×" },
    { label: "\\div", insert: "\\div", detail: "divide ÷" },
    { label: "\\pm", insert: "\\pm", detail: "plus-minus ±" },
    { label: "\\mp", insert: "\\mp", detail: "minus-plus ∓" },
    { label: "\\leq", insert: "\\leq", detail: "≤" },
    { label: "\\geq", insert: "\\geq", detail: "≥" },
    { label: "\\neq", insert: "\\neq", detail: "≠" },
    { label: "\\approx", insert: "\\approx", detail: "≈" },
    { label: "\\equiv", insert: "\\equiv", detail: "≡" },
    { label: "\\sim", insert: "\\sim", detail: "∼" },
    { label: "\\propto", insert: "\\propto", detail: "∝" },
    { label: "\\infty", insert: "\\infty", detail: "∞" },
    { label: "\\partial", insert: "\\partial", detail: "∂" },
    { label: "\\nabla", insert: "\\nabla", detail: "∇" },
    { label: "\\forall", insert: "\\forall", detail: "∀" },
    { label: "\\exists", insert: "\\exists", detail: "∃" },
    { label: "\\in", insert: "\\in", detail: "∈" },
    { label: "\\notin", insert: "\\notin", detail: "∉" },
    { label: "\\subset", insert: "\\subset", detail: "⊂" },
    { label: "\\subseteq", insert: "\\subseteq", detail: "⊆" },
    { label: "\\cup", insert: "\\cup", detail: "∪" },
    { label: "\\cap", insert: "\\cap", detail: "∩" },
    { label: "\\emptyset", insert: "\\emptyset", detail: "∅" },
    // Greek letters
    { label: "\\alpha", insert: "\\alpha", detail: "α" },
    { label: "\\beta", insert: "\\beta", detail: "β" },
    { label: "\\gamma", insert: "\\gamma", detail: "γ" },
    { label: "\\Gamma", insert: "\\Gamma", detail: "Γ" },
    { label: "\\delta", insert: "\\delta", detail: "δ" },
    { label: "\\Delta", insert: "\\Delta", detail: "Δ" },
    { label: "\\epsilon", insert: "\\epsilon", detail: "ε" },
    { label: "\\varepsilon", insert: "\\varepsilon", detail: "ε (var)" },
    { label: "\\zeta", insert: "\\zeta", detail: "ζ" },
    { label: "\\eta", insert: "\\eta", detail: "η" },
    { label: "\\theta", insert: "\\theta", detail: "θ" },
    { label: "\\Theta", insert: "\\Theta", detail: "Θ" },
    { label: "\\vartheta", insert: "\\vartheta", detail: "ϑ" },
    { label: "\\iota", insert: "\\iota", detail: "ι" },
    { label: "\\kappa", insert: "\\kappa", detail: "κ" },
    { label: "\\lambda", insert: "\\lambda", detail: "λ" },
    { label: "\\Lambda", insert: "\\Lambda", detail: "Λ" },
    { label: "\\mu", insert: "\\mu", detail: "μ" },
    { label: "\\nu", insert: "\\nu", detail: "ν" },
    { label: "\\xi", insert: "\\xi", detail: "ξ" },
    { label: "\\Xi", insert: "\\Xi", detail: "Ξ" },
    { label: "\\pi", insert: "\\pi", detail: "π" },
    { label: "\\Pi", insert: "\\Pi", detail: "Π" },
    { label: "\\rho", insert: "\\rho", detail: "ρ" },
    { label: "\\sigma", insert: "\\sigma", detail: "σ" },
    { label: "\\Sigma", insert: "\\Sigma", detail: "Σ" },
    { label: "\\tau", insert: "\\tau", detail: "τ" },
    { label: "\\upsilon", insert: "\\upsilon", detail: "υ" },
    { label: "\\phi", insert: "\\phi", detail: "φ" },
    { label: "\\Phi", insert: "\\Phi", detail: "Φ" },
    { label: "\\varphi", insert: "\\varphi", detail: "φ (var)" },
    { label: "\\chi", insert: "\\chi", detail: "χ" },
    { label: "\\psi", insert: "\\psi", detail: "ψ" },
    { label: "\\Psi", insert: "\\Psi", detail: "Ψ" },
    { label: "\\omega", insert: "\\omega", detail: "ω" },
    { label: "\\Omega", insert: "\\Omega", detail: "Ω" },
    // Arrows
    { label: "\\to", insert: "\\to", detail: "→" },
    { label: "\\rightarrow", insert: "\\rightarrow", detail: "→" },
    { label: "\\leftarrow", insert: "\\leftarrow", detail: "←" },
    { label: "\\Rightarrow", insert: "\\Rightarrow", detail: "⇒" },
    { label: "\\Leftarrow", insert: "\\Leftarrow", detail: "⇐" },
    { label: "\\Leftrightarrow", insert: "\\Leftrightarrow", detail: "⇔" },
    { label: "\\leftrightarrow", insert: "\\leftrightarrow", detail: "↔" },
    { label: "\\iff", insert: "\\iff", detail: "⟺" },
    { label: "\\implies", insert: "\\implies", detail: "⟹" },
    // Decorators
    { label: "\\hat", insert: "\\hat{$1}", detail: "x̂" },
    { label: "\\bar", insert: "\\bar{$1}", detail: "x̄" },
    { label: "\\vec", insert: "\\vec{$1}", detail: "x⃗" },
    { label: "\\dot", insert: "\\dot{$1}", detail: "ẋ" },
    { label: "\\ddot", insert: "\\ddot{$1}", detail: "ẍ" },
    { label: "\\tilde", insert: "\\tilde{$1}", detail: "x̃" },
    { label: "\\overline", insert: "\\overline{$1}", detail: "overline" },
    { label: "\\underline", insert: "\\underline{$1}", detail: "underline" },
    { label: "\\overbrace", insert: "\\overbrace{$1}^{$2}", detail: "overbrace" },
    { label: "\\underbrace", insert: "\\underbrace{$1}_{$2}", detail: "underbrace" },
    // Brackets
    { label: "\\left(\\right)", insert: "\\left( $1 \\right)", detail: "auto-sized ( )" },
    { label: "\\left[\\right]", insert: "\\left[ $1 \\right]", detail: "auto-sized [ ]" },
    { label: "\\left\\{\\right\\}", insert: "\\left\\{ $1 \\right\\}", detail: "auto-sized { }" },
    { label: "\\left|\\right|", insert: "\\left| $1 \\right|", detail: "auto-sized | |" },
    { label: "\\left\\|\\right\\|", insert: "\\left\\| $1 \\right\\|", detail: "auto-sized ‖ ‖" },
    // Trig
    { label: "\\sin", insert: "\\sin", detail: "sine" },
    { label: "\\cos", insert: "\\cos", detail: "cosine" },
    { label: "\\tan", insert: "\\tan", detail: "tangent" },
    { label: "\\ln", insert: "\\ln", detail: "natural log" },
    { label: "\\log", insert: "\\log", detail: "logarithm" },
    { label: "\\exp", insert: "\\exp", detail: "exponential" },
    { label: "\\max", insert: "\\max", detail: "maximum" },
    { label: "\\min", insert: "\\min", detail: "minimum" },
    { label: "\\det", insert: "\\det", detail: "determinant" },
    // Sections
    { label: "\\section", insert: "\\section{$1}", detail: "section heading" },
    { label: "\\subsection", insert: "\\subsection{$1}", detail: "subsection heading" },
    { label: "\\subsubsection", insert: "\\subsubsection{$1}", detail: "subsubsection heading" },
    { label: "\\label", insert: "\\label{$1}", detail: "label" },
    { label: "\\ref", insert: "\\ref{$1}", detail: "reference" },
    { label: "\\eqref", insert: "\\eqref{$1}", detail: "equation reference" },
    { label: "\\cite", insert: "\\cite{$1}", detail: "citation" },
    { label: "\\footnote", insert: "\\footnote{$1}", detail: "footnote" },
  ];

  monaco.languages.registerCompletionItemProvider("latex", {
    triggerCharacters: ["\\"],
    provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
      const word = model.getWordAtPosition(position);
      const range = word
        ? {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          }
        : {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column,
          };

      // Check if preceded by backslash
      const lineUpToCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const startsWithBackslash = /\\[a-zA-Z{]*$/.test(lineUpToCursor);
      if (!startsWithBackslash) return { suggestions: [] };

      const suggestions = SNIPPETS.map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        detail: s.detail,
        insertText: s.insert,
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));

      return { suggestions };
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  proposedValue?: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  fontSize?: number;
  className?: string;
}

export default function EditorPanel({
  value,
  onChange,
  proposedValue,
  onAccept,
  onReject,
  fontSize = 14,
  className = "",
}: EditorPanelProps) {
  const isDiffMode = proposedValue != null;

  const sharedOptions = {
    minimap: { enabled: false },
    wordWrap: "on" as const,
    fontSize,
    scrollBeyondLastLine: false,
    padding: { top: 12 },
    smoothScrolling: true,
    cursorBlinking: "smooth" as const,
    bracketPairColorization: { enabled: true },
    renderWhitespace: "none" as const,
    suggest: { snippetsPreventQuickSuggestions: false },
    quickSuggestions: { other: true, comments: false, strings: false },
  };

  return (
    <div className={`relative ${className}`}>
      {isDiffMode ? (
        <>
          <DiffEditor
            height="100%"
            language="latex"
            theme="latex-dark"
            original={value}
            modified={proposedValue}
            beforeMount={registerLatex}
            options={{
              ...sharedOptions,
              renderSideBySide: false,
              lineNumbers: "on",
              readOnly: true,
            }}
          />
          <div className="absolute top-3 right-3 flex gap-2" style={{ zIndex: 10 }}>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-lg transition-colors"
            >
              Reject
            </button>
          </div>
        </>
      ) : (
        <Editor
          height="100%"
          defaultLanguage="latex"
          theme="latex-dark"
          value={value}
          beforeMount={registerLatex}
          onChange={(v) => onChange(v ?? "")}
          options={{
            ...sharedOptions,
            lineNumbers: "on",
          }}
        />
      )}
    </div>
  );
}
