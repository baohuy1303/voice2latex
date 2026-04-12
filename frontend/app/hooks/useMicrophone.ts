"use client";

import { useState, useRef, useCallback } from "react";

interface UseMicrophoneReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
}

export default function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use webm/opus — browser native, supported by Google STT
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Microphone access denied"
      );
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}
