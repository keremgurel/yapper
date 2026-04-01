"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type RecorderState = "idle" | "preview" | "recording" | "recorded";

export default function Recorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Attach stream to video element whenever videoRef or stream changes
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      setState("preview");
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setCameraOn(false);
        setState("preview");
      } catch {
        alert("Camera and microphone access are required for recording.");
      }
    }
  }, []);

  // When entering preview/recording, attach stream to video
  useEffect(() => {
    if ((state === "preview" || state === "recording") && streamRef.current) {
      // Small delay to let React mount the video element
      requestAnimationFrame(() => attachStream());
    }
  }, [state, attachStream]);

  // Toggle camera track
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => (t.enabled = cameraOn));
  }, [cameraOn]);

  // Toggle mic track
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedUrl(URL.createObjectURL(blob));
      stopStream();
      setState("recorded");
    };
    recorder.start();
    startTimeRef.current = Date.now();
    setState("recording");
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reset = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setDuration(0);
    stopStream();
    setState("idle");
    setCameraOn(true);
    setMicOn(true);
  };

  const download = () => {
    if (!recordedUrl) return;
    const a = document.createElement("a");
    a.href = recordedUrl;
    a.download = `yapper-${new Date().toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  const formatDur = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopStream]);

  // ── Idle: just the record button ──
  if (state === "idle") {
    return (
      <button
        onClick={startPreview}
        className="group relative w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center cursor-pointer shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200"
        title="Record your speech"
      >
        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    );
  }

  // ── Inline camera preview / recording / playback ──
  return (
    <div className="w-full max-w-[480px] mt-4">
      <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-border">
        {/* Video area */}
        <div className="relative aspect-video">
          {state === "recorded" && recordedUrl ? (
            <video
              src={recordedUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!cameraOn ? "hidden" : ""}`}
              />
              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Recording indicator */}
          {state === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono font-semibold">{formatDur(duration)}</span>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-900">
          {state === "recorded" ? (
            <div className="flex items-center gap-3 w-full justify-center">
              <button onClick={download} className="px-5 py-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                Download
              </button>
              <button onClick={reset} className="px-5 py-2 rounded-full bg-slate-700 text-white text-[13px] font-semibold cursor-pointer hover:bg-slate-600 transition-colors">
                Discard
              </button>
            </div>
          ) : (
            <>
              {/* Mic & Camera toggles */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMicOn((m) => !m)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    micOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-500 hover:bg-red-400"
                  }`}
                  title={micOn ? "Mute" : "Unmute"}
                >
                  {micOn ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setCameraOn((c) => !c)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    cameraOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-500 hover:bg-red-400"
                  }`}
                  title={cameraOn ? "Camera off" : "Camera on"}
                >
                  {cameraOn ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Record / Stop */}
              {state === "preview" ? (
                <button
                  onClick={startRecording}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-[3px] border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg"
                  title="Start recording"
                >
                  <div className="w-4 h-4 rounded-full bg-white" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-[3px] border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg animate-pulse"
                  title="Stop recording"
                >
                  <div className="w-4 h-4 rounded-[3px] bg-white" />
                </button>
              )}

              {/* Close */}
              <button
                onClick={reset}
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-red-500 flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
