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
  const playbackRef = useRef<HTMLVideoElement>(null);
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

  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("preview");
    } catch {
      // Try audio-only if camera fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;
        setCameraOn(false);
        setState("preview");
      } catch {
        alert("Camera and microphone access are required for recording.");
      }
    }
  }, []);

  // Toggle camera track
  useEffect(() => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    videoTracks.forEach((t) => (t.enabled = cameraOn));
  }, [cameraOn]);

  // Toggle mic track
  useEffect(() => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach((t) => (t.enabled = micOn));
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
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopStream]);

  // ── Idle state: just the record button ──
  if (state === "idle") {
    return (
      <button
        onClick={startPreview}
        className="group relative w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center cursor-pointer shadow-lg hover:shadow-red-500/30 hover:scale-105 transition-all duration-200"
        title="Record your speech"
      >
        {/* Pulsing ring */}
        <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
        {/* Camera icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>
    );
  }

  // ── Preview / Recording / Recorded: Google Meet-style overlay ──
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Video area */}
        <div className="relative bg-gray-900 aspect-video rounded-t-2xl overflow-hidden">
          {state === "recorded" && recordedUrl ? (
            <video
              ref={playbackRef}
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
                className={`w-full h-full object-cover ${
                  !cameraOn ? "hidden" : ""
                }`}
              />
              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono font-semibold">
                {formatDur(duration)}
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={reset}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Controls bar */}
        <div className="px-5 py-4 flex items-center justify-between">
          {state === "recorded" ? (
            // Recorded state controls
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                onClick={download}
                className="px-5 py-2.5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              >
                Download
              </button>
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-full bg-muted text-foreground text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              >
                Discard
              </button>
            </div>
          ) : (
            // Preview / Recording controls
            <>
              {/* Mic toggle */}
              <div className="flex gap-3">
                <button
                  onClick={() => setMicOn((m) => !m)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    micOn
                      ? "bg-slate-600 hover:bg-slate-500"
                      : "bg-red-500 hover:bg-red-400"
                  }`}
                  title={micOn ? "Mute microphone" : "Unmute microphone"}
                >
                  {micOn ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>

                {/* Camera toggle */}
                <button
                  onClick={() => setCameraOn((c) => !c)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    cameraOn
                      ? "bg-slate-600 hover:bg-slate-500"
                      : "bg-red-500 hover:bg-red-400"
                  }`}
                  title={cameraOn ? "Turn off camera" : "Turn on camera"}
                >
                  {cameraOn ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Record / Stop button */}
              {state === "preview" ? (
                <button
                  onClick={startRecording}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-4 border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg"
                  title="Start recording"
                >
                  <div className="w-5 h-5 rounded-full bg-white" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-4 border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg animate-pulse"
                  title="Stop recording"
                >
                  <div className="w-5 h-5 rounded-[3px] bg-white" />
                </button>
              )}

              {/* Spacer to balance layout */}
              <div className="w-[88px]" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
