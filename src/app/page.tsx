"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
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

const YAPPER_DARK_KEY = "yapper-dark";
const YAPPER_DARK_EVENT = "yapper-dark-pref-changed";

function subscribeDarkMode(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(YAPPER_DARK_EVENT, handler);
  mq.addEventListener("change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(YAPPER_DARK_EVENT, handler);
    mq.removeEventListener("change", handler);
  };
}

function getDarkModeSnapshot(): boolean {
  const stored = localStorage.getItem(YAPPER_DARK_KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getDarkModeServerSnapshot(): boolean {
  return true;
}

function getRandomTopic(
  exclude: Topic | null,
  category: Category | "All",
  difficulty: Difficulty | "All",
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

function pickReelBlurbs(): string[] {
  return Array.from(
    { length: 5 },
    () => topics[Math.floor(Math.random() * topics.length)].text,
  );
}

export default function Home() {
  const [topic, setTopic] = useState<Topic>(() =>
    getRandomTopic(null, "All", "All"),
  );
  const [spinning, setSpinning] = useState(false);
  const [reelBlurbs, setReelBlurbs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const darkMode = useSyncExternalStore(
    subscribeDarkMode,
    getDarkModeSnapshot,
    getDarkModeServerSnapshot,
  );

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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // ── Topic generation ──
  const generateTopic = useCallback(() => {
    setReelBlurbs(pickReelBlurbs());
    setSpinning(true);
    const tickInterval = setInterval(
      () => playSlotTick(600 + Math.random() * 400),
      80,
    );
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setReelBlurbs([]);
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
      streamRef.current
        ?.getVideoTracks()
        .forEach((t) => streamRef.current!.removeTrack(t));
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
          const vidStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
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
      streamRef.current
        ?.getAudioTracks()
        .forEach((t) => streamRef.current!.removeTrack(t));
      setMicOn(false);
      if (!cameraOn) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } else {
      try {
        if (streamRef.current) {
          const audStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
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
    <div className="flex min-h-screen flex-col transition-colors duration-300">
      {/* Header */}
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
            Y
          </div>
          <span className="text-foreground text-[18px] font-extrabold tracking-tight">
            yapper
          </span>
          <span className="ml-1 text-[11px] text-slate-500">ypr.app</span>
        </div>
        <button
          onClick={() => {
            const next = !darkMode;
            localStorage.setItem(YAPPER_DARK_KEY, String(next));
            window.dispatchEvent(new Event(YAPPER_DARK_EVENT));
          }}
          className="border-border hover:bg-muted cursor-pointer rounded-lg border bg-transparent px-3 py-1 text-[12px] text-slate-500 transition-colors"
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </header>

      {/* Headline */}
      <div className="px-6 pt-6 pb-4 text-center">
        <h1 className="text-foreground mb-1 text-[26px] font-extrabold tracking-tight">
          Pull the lever. Start talking.
        </h1>
        <p className="text-[14px] text-slate-500">
          Random topic generator for impromptu speaking practice.
        </p>
      </div>

      {/* ═══ CAMERA CONTAINER ═══ */}
      <main className="flex flex-1 items-center justify-center px-4 pb-4">
        <div
          className="relative w-full max-w-[920px] overflow-hidden rounded-2xl border border-white/10 bg-gray-900"
          style={{ aspectRatio: "16/9", maxHeight: "calc(100vh - 200px)" }}
        >
          {/* Video feed (background) */}
          {cameraOn && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Dark overlay when camera is off */}
          {!cameraOn && (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900" />
          )}

          {/* Semi-transparent overlay to keep text readable over video */}
          {cameraOn && <div className="absolute inset-0 bg-black/30" />}

          {/* ── Top-left: Filters + REC indicator ── */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-xs font-semibold text-white">
                  REC
                </span>
              </div>
            )}
            <div
              className={`flex gap-2 transition-all duration-500 ${
                inSession ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="cursor-pointer rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white backdrop-blur-md outline-none"
              >
                {["All", ...CATEGORIES].map((o) => (
                  <option key={o} value={o}>
                    {o === "All" ? "All Topics" : o}
                  </option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => handleDifficultyChange(e.target.value)}
                className="cursor-pointer rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white backdrop-blur-md outline-none"
              >
                {["All", ...DIFFICULTIES].map((o) => (
                  <option key={o} value={o}>
                    {o === "All" ? "All Levels" : o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Top-right: Mic / Camera toggles ── */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button
              onClick={toggleMic}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 backdrop-blur-md transition-all duration-200 ${
                micOn
                  ? "bg-white/15 hover:bg-white/25"
                  : "border-red-400/30 bg-red-500/80 hover:bg-red-400/80"
              }`}
              title={micOn ? "Mute" : "Unmute"}
            >
              {micOn ? (
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
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
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
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleCamera}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 backdrop-blur-md transition-all duration-200 ${
                cameraOn
                  ? "bg-white/15 hover:bg-white/25"
                  : "border-red-400/30 bg-red-500/80 hover:bg-red-400/80"
              }`}
              title={cameraOn ? "Camera off" : "Camera on"}
            >
              {cameraOn ? (
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
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ) : (
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
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* ── Content overlay — topic pinned to top, buttons at bottom ── */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-6 pt-14 pb-5">
            {/* Topic card — pinned near top */}
            <div className="w-full max-w-[500px]">
              <TopicReel
                topic={topic}
                spinning={spinning}
                reelBlurbs={reelBlurbs}
              />
            </div>

            {/* Timer — centered */}
            <div
              className={`font-mono text-[52px] leading-none font-bold tracking-[4px] drop-shadow-lg transition-colors duration-300 ${timerColor} ${
                isRunning && timeLeft <= 10 ? "animate-pulse" : ""
              }`}
            >
              {formatTime(timeLeft)}
            </div>

            {/* Buttons — pinned to bottom */}
            <div className="flex items-center gap-2">
              {!isRunning && !timerDone && (
                <button
                  onClick={startTimer}
                  className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                >
                  Start
                </button>
              )}
              {isRunning && (
                <>
                  <button
                    onClick={pauseTimer}
                    className={`cursor-pointer rounded-full border border-white/10 px-5 py-2.5 text-[13px] font-semibold backdrop-blur-md transition-opacity hover:opacity-80 ${
                      isPaused
                        ? "border-blue-400/30 bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                        : "bg-black/30 text-white"
                    }`}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="cursor-pointer rounded-full border border-white/10 bg-black/30 px-5 py-2.5 text-[13px] font-semibold text-white backdrop-blur-md transition-opacity hover:opacity-80"
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
                    className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                  >
                    Try Another
                  </button>
                  {recordedUrl && (
                    <button
                      onClick={downloadRecording}
                      className="cursor-pointer rounded-full border border-white/10 bg-black/30 px-5 py-2.5 text-[13px] font-semibold text-white backdrop-blur-md transition-opacity hover:opacity-80"
                    >
                      Download
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Lever (left, glass container, fades during session) ── */}
          <div
            className={`absolute bottom-16 left-5 z-10 transition-all duration-500 ${
              inSession
                ? "pointer-events-none scale-90 opacity-0"
                : "scale-100 opacity-100"
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <SlotLever onPull={generateTopic} />
            </div>
          </div>

          {/* ── Knob (right, glass container, fades during session) ── */}
          <div
            className={`absolute right-5 bottom-16 z-10 transition-all duration-500 ${
              inSession
                ? "pointer-events-none scale-90 opacity-0"
                : "scale-100 opacity-100"
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <RotaryKnob
                value={timerSeconds}
                onChange={handleKnobChange}
                min={30}
                max={90}
                disabled={isRunning}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-2 text-center text-[11px] text-slate-500/60">
        yapper · ypr.app
      </footer>
    </div>
  );
}
