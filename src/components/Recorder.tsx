"use client";

import { useState, useRef } from "react";

export default function Recorder() {
  const [state, setState] = useState<"idle" | "recording" | "recorded">(
    "idle"
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      chunks.current = [];
      recorder.ondataavailable = (e) => chunks.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      startTime.current = Date.now();
      setState("recording");
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime.current) / 1000));
      }, 200);
    } catch {
      alert("Microphone access is required for recording.");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorder.current &&
      mediaRecorder.current.state === "recording"
    ) {
      mediaRecorder.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setState("recorded");
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
  };

  const download = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `yapper-recording-${new Date().toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  const formatDur = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col items-center gap-3 w-full max-w-[400px]">
      <div className="text-[10px] text-slate-500 uppercase tracking-[1.5px] font-semibold">
        RECORD YOUR SPEECH
      </div>

      {state === "idle" && (
        <button
          onClick={startRecording}
          className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-red-500 to-red-600 border-[3px] border-red-500/30 cursor-pointer flex items-center justify-center shadow-[0_2px_12px_rgba(239,68,68,0.3)] hover:scale-105 transition-transform"
        >
          <div className="w-5 h-5 rounded-full bg-white" />
        </button>
      )}

      {state === "recording" && (
        <>
          <button
            onClick={stopRecording}
            className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-red-500 to-red-600 border-[3px] border-red-500/30 cursor-pointer flex items-center justify-center shadow-[0_2px_12px_rgba(239,68,68,0.3)] animate-pulse"
          >
            <div className="w-[18px] h-[18px] rounded-[3px] bg-white" />
          </button>
          <div className="text-xl font-mono text-red-500 font-bold">
            {formatDur(duration)}
          </div>
        </>
      )}

      {state === "recorded" && audioUrl && (
        <>
          <audio
            controls
            src={audioUrl}
            className="w-full max-w-[340px] h-10"
          />
          <div className="text-[13px] text-slate-500">
            Duration: {formatDur(duration)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={download}
              className="px-5 py-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              Download
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-muted text-foreground text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            >
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
