"use client";

import { useState, useCallback, useRef } from "react";
import { streamChat, StreamEvent } from "../lib/api";

interface UseStreamingChatReturn {
  isStreaming: boolean;
  streamedReply: string;
  pendingDocument: { action: string; new_document: string } | null;
  error: string | null;
  sendMessage: (
    message: string,
    document: string,
    sessionId?: string,
    context?: string,
    mode?: "edit" | "tutor",
    imagesBase64?: string[]
  ) => Promise<void>;
  clearPending: () => void;
}

export default function useStreamingChat(): UseStreamingChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedReply, setStreamedReply] = useState("");
  const [pendingDocument, setPendingDocument] = useState<{
    action: string;
    new_document: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rawTextRef = useRef("");

  const sendMessage = useCallback(
    async (
      message: string,
      document: string,
      sessionId?: string,
      context?: string,
      mode: "edit" | "tutor" = "edit",
      imagesBase64?: string[]
    ) => {
      setIsStreaming(true);
      setStreamedReply("");
      setPendingDocument(null);
      setError(null);
      rawTextRef.current = "";

      try {
        await streamChat(
          message,
          document,
          (event: StreamEvent) => {
            switch (event.type) {
              case "chunk":
                // Raw streamed text from Gemini (JSON being built up)
                if (event.text) {
                  rawTextRef.current += event.text;
                  // Show a "thinking" indicator while streaming
                  setStreamedReply("Thinking...");
                }
                break;
              case "document":
                // Final parsed result — show the reply and set pending document
                if (event.reply) {
                  setStreamedReply(event.reply);
                }
                if (event.action && event.action !== "no_change" && event.new_document !== undefined) {
                  setPendingDocument({
                    action: event.action,
                    new_document: event.new_document,
                  });
                }
                break;
              case "error":
                setError(event.message || "Unknown error");
                break;
              case "done":
                break;
            }
          },
          sessionId,
          context,
          mode,
          imagesBase64
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stream failed");
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const clearPending = useCallback(() => {
    setPendingDocument(null);
  }, []);

  return {
    isStreaming,
    streamedReply,
    pendingDocument,
    error,
    sendMessage,
    clearPending,
  };
}
