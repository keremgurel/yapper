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
import { HomeFaq } from "@/components/home-faq";

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

const TIMER_MIN_SECONDS = 30;
const TIMER_MAX_SECONDS = 90;

function clampTimerSeconds(n: number): number {
  return Math.min(
    TIMER_MAX_SECONDS,
    Math.max(TIMER_MIN_SECONDS, Math.round(n)),
  );
}

export default function HomeClient() {
  const [topic, setTopic] = useState<Topic>(() =>
    getRandomTopic(null, "All", "All"),
  );
  const [spinning, setSpinning] = useState(false);
  const [reelBlurbs, setReelBlurbs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [customPromptText, setCustomPromptText] = useState<string | null>(null);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const lastTimerTapRef = useRef(0);
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
    setCustomPromptText(null);
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
    setCustomPromptText(null);
    setTopic(getRandomTopic(topic, cat, difficulty));
  };

  const handleDifficultyChange = (v: string) => {
    const diff = v as Difficulty | "All";
    setDifficulty(diff);
    setCustomPromptText(null);
    setTopic(getRandomTopic(topic, category, diff));
  };

  const openPromptEditor = useCallback(() => {
    setPromptDraft(customPromptText ?? topic.text);
    setPromptEditorOpen(true);
  }, [customPromptText, topic.text]);

  const savePromptDraft = useCallback(() => {
    const trimmed = promptDraft.trim();
    setCustomPromptText(trimmed.length > 0 ? trimmed : null);
    setPromptEditorOpen(false);
  }, [promptDraft]);

  const openTimeEditor = useCallback(() => {
    setTimeDraft(String(timerSeconds));
    setTimeEditorOpen(true);
  }, [timerSeconds]);

  const saveTimeDraft = useCallback(() => {
    const parsed = parseInt(timeDraft, 10);
    if (Number.isNaN(parsed)) {
      setTimeEditorOpen(false);
      return;
    }
    const v = clampTimerSeconds(parsed);
    setTimerSeconds(v);
    if (!isRunning) setTimeLeft(v);
    setTimeEditorOpen(false);
  }, [timeDraft, isRunning]);

  useEffect(() => {
    if (!promptEditorOpen && !timeEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPromptEditorOpen(false);
        setTimeEditorOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promptEditorOpen, timeEditorOpen]);

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
    const v = clampTimerSeconds(val);
    setTimerSeconds(v);
    if (!isRunning) setTimeLeft(v);
  };

  const handleTimerDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isRunning) return;
      e.preventDefault();
      openTimeEditor();
    },
    [isRunning, openTimeEditor],
  );

  const handleTimerTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isRunning) return;
      const now = Date.now();
      if (now - lastTimerTapRef.current < 320) {
        e.preventDefault();
        openTimeEditor();
        lastTimerTapRef.current = 0;
      } else {
        lastTimerTapRef.current = now;
      }
    },
    [isRunning, openTimeEditor],
  );

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
            video: { facingMode: "user" },
          });
          const videoTrack = vidStream.getVideoTracks()[0];
          streamRef.current.addTrack(videoTrack);
        } else {
          // Create new stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
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
            video: cameraOn ? { facingMode: "user" } : false,
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

  const formatSecondsDisplay = (s: number) => `${Math.max(0, Math.floor(s))}s`;

  const canEditPrompt = !inSession && !spinning;
  const canEditTime = !isRunning;

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
        <h1 className="text-foreground mb-2 text-[22px] font-extrabold tracking-tight md:text-[28px]">
          Pull the lever. Start talking.
        </h1>
        <p className="text-foreground/85 mx-auto mb-4 max-w-xl text-[14px] leading-relaxed text-slate-600 md:text-[15px] dark:text-slate-400">
          A free random topic generator for impromptu speaking practice, table
          topics, and speech prompts. No sign-up, no paywall.
        </p>
        <a
          href="#practice"
          className="border-border bg-background text-foreground hover:bg-muted/80 inline-flex items-center justify-center rounded-full border px-6 py-2.5 text-[13px] font-semibold shadow-sm transition-colors"
        >
          Jump to practice
        </a>
      </div>

      {/* ═══ CAMERA CONTAINER ═══ */}
      <main
        id="practice"
        className="flex flex-1 flex-col items-center justify-center px-4 pb-4"
      >
        <div className="shadow-container relative h-[min(82svh,860px)] max-h-[calc(100svh-140px)] w-full max-w-[min(1200px,100%)] overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-100 md:aspect-[16/9] md:h-auto md:max-h-[calc(100vh-200px)] dark:border-white/[0.07] dark:bg-[oklch(0.16_0_0)]">
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
            <div className="absolute inset-0 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-50 dark:from-[oklch(0.20_0_0)] dark:via-[oklch(0.17_0_0)] dark:to-[oklch(0.15_0_0)]" />
          )}

          {/* Semi-transparent overlay to keep text readable over video */}
          {cameraOn && <div className="absolute inset-0 bg-black/30" />}

          {/* ── Top controls ── */}
          <div className="absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
            {isRecording && (
              <div className="absolute top-0 left-0 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md md:static md:flex-none">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-xs font-semibold text-white">
                  REC
                </span>
              </div>
            )}
            <div
              className={`flex min-w-0 flex-1 flex-wrap gap-2 pr-20 transition-all duration-500 md:pr-0 ${
                inSession ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white backdrop-blur-md outline-none sm:flex-none"
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
                className="min-w-0 flex-1 cursor-pointer rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white backdrop-blur-md outline-none sm:flex-none"
              >
                {["All", ...DIFFICULTIES].map((o) => (
                  <option key={o} value={o}>
                    {o === "All" ? "All Levels" : o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex shrink-0 gap-2">
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
          </div>

          {/* ── Content overlay — topic pinned to top, buttons at bottom ── */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pt-20 pb-4 md:px-6 md:pt-4">
            {/* Topic card — pinned near top, same level as filters */}
            <div className="w-full max-w-[560px]">
              <TopicReel
                topic={topic}
                spinning={spinning}
                reelBlurbs={reelBlurbs}
                promptOverride={customPromptText}
                promptEditable={canEditPrompt}
                onPromptDoubleTap={openPromptEditor}
              />
            </div>

            {/* Timer — centered (seconds); double-tap to type duration when idle) */}
            <div className="flex flex-col items-center gap-1">
              <div
                role={canEditTime ? "button" : undefined}
                tabIndex={canEditTime ? 0 : undefined}
                title={
                  canEditTime
                    ? "Double-tap to set seconds (" +
                      TIMER_MIN_SECONDS +
                      "–" +
                      TIMER_MAX_SECONDS +
                      ")"
                    : undefined
                }
                onDoubleClick={handleTimerDoubleClick}
                onTouchEnd={handleTimerTouchEnd}
                onKeyDown={(e) => {
                  if (
                    canEditTime &&
                    (e.key === "Enter" || e.key === " ") &&
                    e.target === e.currentTarget
                  ) {
                    e.preventDefault();
                    openTimeEditor();
                  }
                }}
                className={`font-mono text-[36px] leading-none font-bold tracking-[2px] drop-shadow-lg transition-colors duration-300 md:text-[52px] ${timerColor} touch-manipulation outline-none ${
                  canEditTime
                    ? "cursor-pointer rounded-lg px-2 focus-visible:ring-2 focus-visible:ring-blue-400/60"
                    : ""
                } ${isRunning && timeLeft <= 10 ? "animate-pulse" : ""}`}
              >
                {formatSecondsDisplay(timeLeft)}
              </div>
              {canEditTime && (
                <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                  Seconds · double-tap to type
                </span>
              )}
            </div>

            {/* Buttons + mobile controls — pinned to bottom */}
            <div className="flex w-full flex-col items-center gap-3">
              <div
                className={`flex items-end justify-center gap-3 transition-all duration-500 md:hidden ${
                  inSession
                    ? "pointer-events-none scale-95 opacity-0"
                    : "scale-100 opacity-100"
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
                  <SlotLever onPull={generateTopic} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
                  <RotaryKnob
                    value={timerSeconds}
                    onChange={handleKnobChange}
                    min={TIMER_MIN_SECONDS}
                    max={TIMER_MAX_SECONDS}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
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
          </div>

          {/* ── Lever (left, desktop only inside container) ── */}
          <div
            className={`absolute bottom-4 left-4 z-10 hidden transition-all duration-500 md:block ${
              inSession
                ? "pointer-events-none scale-90 opacity-0"
                : "scale-100 opacity-100"
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <SlotLever onPull={generateTopic} />
            </div>
          </div>

          {/* ── Knob (right, desktop only inside container) ── */}
          <div
            className={`absolute right-4 bottom-4 z-10 hidden transition-all duration-500 md:block ${
              inSession
                ? "pointer-events-none scale-90 opacity-0"
                : "scale-100 opacity-100"
            }`}
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <RotaryKnob
                value={timerSeconds}
                onChange={handleKnobChange}
                min={TIMER_MIN_SECONDS}
                max={TIMER_MAX_SECONDS}
                disabled={isRunning}
              />
            </div>
          </div>
        </div>
      </main>

      <HomeFaq />

      {/* Footer */}
      <footer className="border-border border-t py-4 text-center text-[11px] text-slate-500/70 dark:text-slate-500/50">
        yapper · ypr.app
      </footer>

      {promptEditorOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPromptEditorOpen(false);
          }}
        >
          <div
            className="border-border bg-background w-full max-w-md rounded-2xl border p-5 shadow-xl"
            role="dialog"
            aria-labelledby="prompt-editor-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3
              id="prompt-editor-title"
              className="text-foreground mb-2 text-sm font-semibold"
            >
              Your prompt
            </h3>
            <p className="mb-3 text-[12px] text-slate-500">
              This replaces the current topic until you pull the lever again or
              change filters.
            </p>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  savePromptDraft();
                }
              }}
              rows={4}
              className="border-border bg-muted/30 text-foreground focus:ring-ring w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="Type your speaking prompt…"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromptEditorOpen(false)}
                className="border-border hover:bg-muted cursor-pointer rounded-lg border bg-transparent px-4 py-2 text-[13px] text-slate-600 transition-colors dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePromptDraft}
                className="cursor-pointer rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.35)] transition-opacity hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {timeEditorOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTimeEditorOpen(false);
          }}
        >
          <div
            className="border-border bg-background w-full max-w-sm rounded-2xl border p-5 shadow-xl"
            role="dialog"
            aria-labelledby="time-editor-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3
              id="time-editor-title"
              className="text-foreground mb-2 text-sm font-semibold"
            >
              Timer (seconds)
            </h3>
            <p className="mb-3 text-[12px] text-slate-500">
              Enter a duration from {TIMER_MIN_SECONDS} to {TIMER_MAX_SECONDS}{" "}
              seconds.
            </p>
            <input
              type="number"
              min={TIMER_MIN_SECONDS}
              max={TIMER_MAX_SECONDS}
              step={1}
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTimeDraft();
                }
              }}
              className="border-border bg-muted/30 text-foreground focus:ring-ring w-full rounded-xl border px-3 py-2 font-mono text-lg outline-none focus:ring-2"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTimeEditorOpen(false)}
                className="border-border hover:bg-muted cursor-pointer rounded-lg border bg-transparent px-4 py-2 text-[13px] text-slate-600 transition-colors dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTimeDraft}
                className="cursor-pointer rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.35)] transition-opacity hover:opacity-90"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
