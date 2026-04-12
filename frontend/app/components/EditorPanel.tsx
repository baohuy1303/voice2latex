"use client";

import dynamic from "next/dynamic";

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

interface EditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  proposedValue?: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  className?: string;
}

export default function EditorPanel({
  value,
  onChange,
  proposedValue,
  onAccept,
  onReject,
  className = "",
}: EditorPanelProps) {
  const isDiffMode = proposedValue != null;

  return (
    <div className={`relative ${className}`}>
      {isDiffMode ? (
        <>
          <DiffEditor
            height="100%"
            language="latex"
            theme="vs-dark"
            original={value}
            modified={proposedValue}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",
              fontSize: 14,
              renderSideBySide: false,
              scrollBeyondLastLine: false,
              readOnly: true,
              padding: { top: 12 },
            }}
          />
          {/* Accept / Reject buttons */}
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
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            renderWhitespace: "none",
            smoothScrolling: true,
            cursorBlinking: "smooth",
          }}
        />
      )}
    </div>
  );
}
