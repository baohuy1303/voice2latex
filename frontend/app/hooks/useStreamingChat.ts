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
    context?: string
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
  const replyRef = useRef("");

  const sendMessage = useCallback(
    async (
      message: string,
      document: string,
      sessionId?: string,
      context?: string
    ) => {
      setIsStreaming(true);
      setStreamedReply("");
      setPendingDocument(null);
      setError(null);
      replyRef.current = "";

      try {
        await streamChat(
          message,
          document,
          (event: StreamEvent) => {
            switch (event.type) {
              case "reply":
                if (event.chunk) {
                  replyRef.current += (replyRef.current ? " " : "") + event.chunk;
                  setStreamedReply(replyRef.current);
                }
                break;
              case "document":
                if (event.action && event.new_document !== undefined) {
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
          context
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
