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

interface EditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function EditorPanel({ value, onChange, className = "" }: EditorPanelProps) {
  return (
    <div className={`${className}`}>
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
    </div>
  );
}
