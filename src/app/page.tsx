"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import topics, {
  CATEGORIES,
  DIFFICULTIES,
  type Topic,
  type Category,
  type Difficulty,
} from "@/data/topics";
import { playSlotTick, playTimerEnd } from "@/lib/audio";
import SlotLever from "@/components/SlotLever";
import RotaryKnob from "@/components/RotaryKnob";
import TopicReel from "@/components/TopicReel";

function getRandomTopic(
  exclude: Topic | null,
  category: Category | "All",
  difficulty: Difficulty | "All"
): Topic {
  let pool = topics;
  if (category !== "All") pool = pool.filter((t) => t.category === category);
  if (difficulty !== "All")
    pool = pool.filter((t) => t.difficulty === difficulty);
  if (pool.length === 0) pool = topics;
  let t: Topic;
  do {
    t = pool[Math.floor(Math.random() * pool.length)];
  } while (t === exclude && pool.length > 1);
  return t;
}

export default function Home() {
  const [topic, setTopic] = useState<Topic>(() =>
    getRandomTopic(null, "All", "All")
  );
  const [spinning, setSpinning] = useState(false);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Camera/mic state
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Whether we're in "active session" (timer running or paused)
  const inSession = isRunning || isPaused;

  // ── Dark mode ──
  useEffect(() => {
    const stored = localStorage.getItem("yapper-dark");
    if (stored !== null) {
      setDarkMode(stored === "true");
    } else {
      setDarkMode(
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("yapper-dark", String(darkMode));
  }, [darkMode]);

  // ── Topic generation ──
  const generateTopic = useCallback(() => {
    setSpinning(true);
    const tickInterval = setInterval(
      () => playSlotTick(600 + Math.random() * 400),
      80
    );
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setTopic((prev) => getRandomTopic(prev, category, difficulty));
    }, 600);
  }, [category, difficulty]);

  const handleCategoryChange = (v: string) => {
    const cat = v as Category | "All";
    setCategory(cat);
    setTopic(getRandomTopic(topic, cat, difficulty));
  };

  const handleDifficultyChange = (v: string) => {
    const diff = v as Difficulty | "All";
    setDifficulty(diff);
    setTopic(getRandomTopic(topic, category, diff));
  };

  // ── Timer ──
  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setTimerDone(true);
            playTimerEnd();
            // Stop recording when timer ends
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
              setIsRecording(false);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, timeLeft]);

  const startTimer = () => {
    setTimeLeft(timerSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerDone(false);
    setRecordedUrl(null);

    // Auto-start recording if stream is active
    if (streamRef.current) {
      chunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      setIsRecording(true);
    }
  };

  const pauseTimer = () => setIsPaused((p) => !p);

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(false);
    setTimeLeft(timerSeconds);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKnobChange = (val: number) => {
    setTimerSeconds(val);
    if (!isRunning) setTimeLeft(val);
  };

  // ── Camera/Mic ──
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      // Turn off camera
      streamRef.current?.getVideoTracks().forEach((t) => t.stop());
      streamRef.current?.getVideoTracks().forEach((t) => streamRef.current!.removeTrack(t));
      setCameraOn(false);
      // If mic is also off, kill the whole stream
      if (!micOn) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } else {
      // Turn on camera
      try {
        if (streamRef.current) {
          // Add video track to existing stream
          const vidStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = vidStream.getVideoTracks()[0];
          streamRef.current.addTrack(videoTrack);
        } else {
          // Create new stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: micOn,
          });
          streamRef.current = stream;
          if (!micOn) {
            stream.getAudioTracks().forEach((t) => t.stop());
            stream.getAudioTracks().forEach((t) => stream.removeTrack(t));
          }
        }
        setCameraOn(true);
        requestAnimationFrame(() => attachStream());
      } catch {
        alert("Camera access is required.");
      }
    }
  }, [cameraOn, micOn, attachStream]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      streamRef.current?.getAudioTracks().forEach((t) => t.stop());
      streamRef.current?.getAudioTracks().forEach((t) => streamRef.current!.removeTrack(t));
      setMicOn(false);
      if (!cameraOn) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } else {
      try {
        if (streamRef.current) {
          const audStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = audStream.getAudioTracks()[0];
          streamRef.current.addTrack(audioTrack);
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: cameraOn,
          });
          streamRef.current = stream;
          if (!cameraOn) {
            stream.getVideoTracks().forEach((t) => t.stop());
            stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
          }
        }
        setMicOn(true);
      } catch {
        alert("Microphone access is required.");
      }
    }
  }, [micOn, cameraOn]);

  // Re-attach video when camera toggles on
  useEffect(() => {
    if (cameraOn) {
      requestAnimationFrame(() => attachStream());
    }
  }, [cameraOn, attachStream]);

  // Download recording
  const downloadRecording = () => {
    if (!recordedUrl) return;
    const a = document.createElement("a");
    a.href = recordedUrl;
    a.download = `yapper-${new Date().toISOString().slice(0, 19)}.webm`;
    a.click();
  };

  const timerColor =
    timeLeft <= 10
      ? "text-red-500"
      : timeLeft <= 30
      ? "text-amber-500"
      : "text-white";

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-[28px] h-[28px] rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-sm font-black text-white">
            Y
          </div>
          <span className="text-[18px] font-extrabold text-foreground tracking-tight">
            yapper
          </span>
          <span className="text-[11px] text-slate-500 ml-1">ypr.app</span>
        </div>
        <button
          onClick={() => setDarkMode((d) => !d)}
          className="bg-transparent border border-border rounded-lg px-3 py-1 cursor-pointer text-[12px] text-slate-500 hover:bg-muted transition-colors"
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </header>

      {/* Headline */}
      <div className="text-center pt-6 pb-4 px-6">
        <h1 className="text-[26px] font-extrabold text-foreground tracking-tight mb-1">
          Pull the lever. Start talking.
        </h1>
        <p className="text-[14px] text-slate-500">
          Random topic generator for impromptu speaking practice.
        </p>
      </div>

      {/* ═══ CAMERA CONTAINER ═══ */}
      <main className="flex-1 flex items-center justify-center px-4 pb-4">
        <div className="relative w-full max-w-[920px] rounded-2xl overflow-hidden bg-gray-900 border border-white/10"
          style={{ aspectRatio: "16/9", maxHeight: "calc(100vh - 200px)" }}
        >
          {/* Video feed (background) */}
          {cameraOn && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Dark overlay when camera is off */}
          {!cameraOn && (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900" />
          )}

          {/* Semi-transparent overlay to keep text readable over video */}
          {cameraOn && (
            <div className="absolute inset-0 bg-black/30" />
          )}

          {/* ── Recording indicator ── */}
          {isRecording && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-mono font-semibold">REC</span>
            </div>
          )}

          {/* ── Mic / Camera toggles (always visible, top-right) ── */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button
              onClick={toggleMic}
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-sm ${
                micOn
                  ? "bg-white/20 hover:bg-white/30"
                  : "bg-red-500/80 hover:bg-red-400/80"
              }`}
              title={micOn ? "Mute" : "Unmute"}
            >
              {micOn ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                  <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleCamera}
              className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 backdrop-blur-sm ${
                cameraOn
                  ? "bg-white/20 hover:bg-white/30"
                  : "bg-red-500/80 hover:bg-red-400/80"
              }`}
              title={cameraOn ? "Camera off" : "Camera on"}
            >
              {cameraOn ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* ── Filters (top-center, fade out during session) ── */}
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 transition-all duration-500 ${
              inSession ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="bg-black/40 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white cursor-pointer outline-none"
            >
              {["All", ...CATEGORIES].map((o) => (
                <option key={o} value={o}>{o === "All" ? "All Topics" : o}</option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => handleDifficultyChange(e.target.value)}
              className="bg-black/40 backdrop-blur-sm border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-white cursor-pointer outline-none"
            >
              {["All", ...DIFFICULTIES].map((o) => (
                <option key={o} value={o}>{o === "All" ? "All Levels" : o}</option>
              ))}
            </select>
          </div>

          {/* ── Content overlay ── */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
            {/* Topic card — always visible */}
            <div className="w-full max-w-[500px] mb-6">
              <TopicReel topic={topic} spinning={spinning} />
            </div>

            {/* Timer — always visible */}
            <div
              className={`text-[48px] font-bold font-mono tracking-[4px] leading-none transition-colors duration-300 mb-4 drop-shadow-lg ${timerColor} ${
                isRunning && timeLeft <= 10 ? "animate-pulse" : ""
              }`}
            >
              {formatTime(timeLeft)}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 items-center mb-4">
              {!isRunning && !timerDone && (
                <button
                  onClick={startTimer}
                  className="px-7 py-2.5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer shadow-[0_2px_12px_rgba(37,99,235,0.4)] hover:opacity-90 transition-opacity"
                >
                  Start
                </button>
              )}
              {isRunning && (
                <>
                  <button
                    onClick={pauseTimer}
                    className={`px-5 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-80 ${
                      isPaused
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                        : "bg-white/20 backdrop-blur-sm text-white"
                    }`}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    Reset
                  </button>
                </>
              )}
              {timerDone && (
                <>
                  <button
                    onClick={() => {
                      resetTimer();
                      generateTopic();
                    }}
                    className="px-7 py-2.5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[13px] font-semibold cursor-pointer shadow-[0_2px_12px_rgba(37,99,235,0.4)] hover:opacity-90 transition-opacity"
                  >
                    Try Another
                  </button>
                  {recordedUrl && (
                    <button
                      onClick={downloadRecording}
                      className="px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      Download
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Lever (bottom-left, fades during session) ── */}
          <div
            className={`absolute bottom-4 left-6 z-10 transition-all duration-500 ${
              inSession ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
            }`}
          >
            <SlotLever onPull={generateTopic} />
          </div>

          {/* ── Knob (bottom-right, fades during session) ── */}
          <div
            className={`absolute bottom-4 right-6 z-10 transition-all duration-500 ${
              inSession ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
            }`}
          >
            <RotaryKnob
              value={timerSeconds}
              onChange={handleKnobChange}
              min={30}
              max={120}
              disabled={isRunning}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-2 text-[11px] text-slate-500/60">
        yapper · ypr.app
      </footer>
    </div>
  );
}
