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
import { MeshGradient } from "@paper-design/shaders-react";

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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

async function exportRecordingWithOverlays({
  blob,
  prompt,
  timerSeconds,
  showPromptOverlay,
  showTimerOverlay,
}: {
  blob: Blob;
  prompt: string;
  timerSeconds: number;
  showPromptOverlay: boolean;
  showTimerOverlay: boolean;
}): Promise<Blob> {
  if (!showPromptOverlay && !showTimerOverlay) return blob;

  const sourceUrl = URL.createObjectURL(blob);

  try {
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.playsInline = true;
    video.preload = "auto";
    video.volume = 0;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load recording."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    const canvasStream = canvas.captureStream(30);
    const v = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
    };
    const playbackStream =
      typeof v.captureStream === "function" ? v.captureStream() : undefined;
    const mergedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(playbackStream?.getAudioTracks() ?? []),
    ]);

    const recorder = new MediaRecorder(mergedStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
    });

    const drawFrame = () => {
      if (video.ended || video.paused) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (showPromptOverlay) {
        const boxX = canvas.width * 0.07;
        const boxY = canvas.height * 0.06;
        const boxWidth = canvas.width * 0.86;
        const boxHeight = canvas.height * 0.2;
        const radius = 28;

        ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxWidth - radius, boxY);
        ctx.quadraticCurveTo(
          boxX + boxWidth,
          boxY,
          boxX + boxWidth,
          boxY + radius,
        );
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
        ctx.quadraticCurveTo(
          boxX + boxWidth,
          boxY + boxHeight,
          boxX + boxWidth - radius,
          boxY + boxHeight,
        );
        ctx.lineTo(boxX + radius, boxY + boxHeight);
        ctx.quadraticCurveTo(
          boxX,
          boxY + boxHeight,
          boxX,
          boxY + boxHeight - radius,
        );
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(canvas.width * 0.045)}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lines = wrapCanvasText(ctx, prompt, boxWidth - 64).slice(0, 3);
        const lineHeight = canvas.height * 0.045;
        const startY =
          boxY + boxHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
          ctx.fillText(line, boxX + boxWidth / 2, startY + index * lineHeight);
        });
      }

      if (showTimerOverlay) {
        const secondsLeft = Math.max(
          0,
          Math.ceil(timerSeconds - video.currentTime),
        );
        ctx.fillStyle = "rgba(15, 23, 42, 0.66)";
        ctx.beginPath();
        ctx.roundRect(
          canvas.width * 0.34,
          canvas.height * 0.78,
          canvas.width * 0.32,
          canvas.height * 0.12,
          28,
        );
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(canvas.width * 0.08)}px Geist, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${secondsLeft}s`,
          canvas.width * 0.5,
          canvas.height * 0.84,
        );
      }

      requestAnimationFrame(drawFrame);
    };

    recorder.start(200);
    await video.play();
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    recorder.stop();
    mergedStream.getTracks().forEach((track) => track.stop());
    return await finished;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function HomeClient() {
  const [topic, setTopic] = useState<Topic>(topics[0]);
  const [spinning, setSpinning] = useState(false);

  // Randomize on mount to avoid hydration mismatch from Math.random()
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      setTopic(getRandomTopic(null, "All", "All"));
    }
  }, []);
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
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [includePromptOverlay, setIncludePromptOverlay] = useState(true);
  const [includeTimerOverlay, setIncludeTimerOverlay] = useState(true);
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeInputRef = useRef<HTMLInputElement>(null);

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

  const cancelPromptDraft = useCallback(() => {
    setPromptDraft(customPromptText ?? topic.text);
    setPromptEditorOpen(false);
  }, [customPromptText, topic.text]);

  const openTimeEditor = useCallback(() => {
    setTimeDraft(String(timerSeconds));
    setTimeEditorOpen(true);
  }, [timerSeconds]);

  const saveTimeDraft = useCallback(() => {
    const parsed = parseInt(timeDraft, 10);
    if (Number.isNaN(parsed)) {
      setTimeDraft(String(timerSeconds));
      setTimeEditorOpen(false);
      return;
    }
    const v = clampTimerSeconds(parsed);
    setTimerSeconds(v);
    if (!isRunning) setTimeLeft(v);
    setTimeEditorOpen(false);
  }, [timeDraft, isRunning, timerSeconds]);

  const cancelTimeDraft = useCallback(() => {
    setTimeDraft(String(timerSeconds));
    setTimeEditorOpen(false);
  }, [timerSeconds]);

  useEffect(() => {
    if (!timeEditorOpen) return;
    requestAnimationFrame(() => {
      timeInputRef.current?.focus();
      timeInputRef.current?.select();
    });
  }, [timeEditorOpen]);

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
    setPromptEditorOpen(false);
    setTimeEditorOpen(false);
    setRecordedBlob(null);
    setIsPreparingDownload(false);
    setIsExportingVideo(false);

    // Auto-start recording if stream is active
    if (streamRef.current) {
      chunksRef.current = [];
      setIsPreparingDownload(true);
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
        setRecordedBlob(blob);
        setIsPreparingDownload(false);
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
    setIsPreparingDownload(false);
    setIsExportingVideo(false);
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
  const downloadRecording = useCallback(async () => {
    if (!recordedBlob || isExportingVideo) return;

    setIsExportingVideo(true);

    try {
      const exportedBlob = await exportRecordingWithOverlays({
        blob: recordedBlob,
        prompt: customPromptText ?? topic.text,
        timerSeconds,
        showPromptOverlay: includePromptOverlay,
        showTimerOverlay: includeTimerOverlay,
      });
      const a = document.createElement("a");
      const url = URL.createObjectURL(exportedBlob);
      a.href = url;
      a.download = `yapper-${new Date().toISOString().slice(0, 19)}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsExportingVideo(false);
    }
  }, [
    recordedBlob,
    isExportingVideo,
    customPromptText,
    topic.text,
    timerSeconds,
    includePromptOverlay,
    includeTimerOverlay,
  ]);

  const timerColor =
    timeLeft <= 10
      ? "text-red-600 dark:text-red-500"
      : timeLeft <= 30
        ? "text-amber-600 dark:text-amber-500"
        : cameraOn
          ? "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
          : "text-slate-900 dark:text-white";

  const formatSecondsDisplay = (s: number) => `${Math.max(0, Math.floor(s))}s`;

  const canEditPrompt = !inSession && !spinning;
  const canEditTime = !isRunning;

  const toolChromePanel =
    "rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/35 dark:shadow-none";

  const selectClass =
    "min-w-0 flex-1 cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] outline-none backdrop-blur-md sm:flex-none " +
    (cameraOn
      ? "border-white/10 bg-black/30 text-white"
      : "border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/30 dark:text-white");

  const sessionBtnIdle =
    "cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold backdrop-blur-md transition-opacity hover:opacity-80 " +
    (cameraOn
      ? "border-white/10 bg-black/30 text-white"
      : "border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/30 dark:text-white");

  return (
    <div className="flex min-h-screen flex-col transition-colors duration-300">
      {/* Header */}
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
            Y
          </div>
          <span className="font-display text-foreground text-[22px] font-semibold tracking-[0.02em]">
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
      <div className="px-6 pt-10 pb-16 text-center md:pt-14 md:pb-24">
        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/12 dark:bg-zinc-800/90 dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(249,115,22,0.45)]">
              Y
            </span>
            <span className="font-display text-[18px] font-semibold tracking-[0.01em] text-slate-900 dark:text-zinc-50">
              Pull the lever. Start talking.
            </span>
            <span
              className="text-[15px] font-medium text-slate-600 dark:text-zinc-400"
              aria-hidden
            >
              →
            </span>
          </div>
        </div>
        <h1 className="font-display text-foreground mx-auto mb-4 max-w-4xl text-[40px] leading-[0.88] font-semibold tracking-[-0.03em] md:text-[72px]">
          Free Topic Generator
          <br />
          for Speech Practice
        </h1>
        <p className="text-foreground/85 mx-auto mb-7 max-w-2xl text-[16px] leading-relaxed text-slate-600 md:mb-8 md:text-[19px] dark:text-slate-400">
          Practice public speaking alone with random speech topics, table
          topics, a built-in timer, and optional camera/mic recording. No
          sign-up, no paywall, and no setup friction.
        </p>
        <a
          href="#practice"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-900 px-8 py-3.5 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.25)] transition-colors hover:bg-slate-800 dark:border-white/15 dark:bg-white dark:text-slate-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] dark:hover:bg-zinc-100"
        >
          Jump to practice
        </a>
      </div>

      {/* ═══ CAMERA CONTAINER ═══ */}
      <main
        id="practice"
        className="flex flex-1 flex-col items-center justify-center px-4 pt-0 pb-4 md:pt-2"
      >
        <div className="shadow-container relative h-[min(82svh,860px)] max-h-[calc(100svh-140px)] w-full max-w-[min(1200px,100%)] overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-100 md:aspect-[16/9] md:h-auto md:max-h-[calc(100vh-200px)] dark:border-white/[0.08] dark:bg-[oklch(0.16_0_0)] dark:bg-none">
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

          {/* Shader background when camera is off */}
          {!cameraOn && (
            <div className="absolute inset-0">
              <MeshGradient
                className="absolute inset-0 h-full w-full"
                colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
                speed={0.3}
                distortion={0.4}
                swirl={0.3}
              />
            </div>
          )}

          {/* Semi-transparent overlay to keep text readable over video */}
          {cameraOn && <div className="absolute inset-0 bg-black/30" />}

          {/* ── Top controls ── */}
          <div className="absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
            {isRecording && (
              <div
                className={`absolute top-0 left-0 flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-md md:static md:flex-none ${
                  cameraOn
                    ? "border-white/10 bg-black/40 text-white"
                    : "border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/40 dark:text-white"
                }`}
              >
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-xs font-semibold">REC</span>
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
                className={selectClass}
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
                className={selectClass}
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
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 ${
                  micOn
                    ? cameraOn
                      ? "border border-white/10 bg-white/15 text-white hover:bg-white/25"
                      : "border border-slate-200 bg-white/95 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
                    : "border border-red-400/40 bg-red-500 text-white hover:bg-red-400"
                }`}
                title={micOn ? "Mute" : "Unmute"}
              >
                {micOn ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
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
                    stroke="currentColor"
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
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 ${
                  cameraOn
                    ? "border border-white/10 bg-white/15 text-white hover:bg-white/25"
                    : "border border-red-400/40 bg-red-500 text-white hover:bg-red-400"
                }`}
                title={cameraOn ? "Camera off" : "Camera on"}
              >
                {cameraOn ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
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
                    stroke="currentColor"
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

          {/* Content overlay: topic near top, controls at bottom */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pt-20 pb-4 md:px-6 md:pt-4">
            {/* Topic card near top, same level as filters */}
            <div className="w-full max-w-[560px]">
              <TopicReel
                topic={topic}
                spinning={spinning}
                reelBlurbs={reelBlurbs}
                promptOverride={customPromptText}
                promptDraft={promptDraft}
                promptEditing={promptEditorOpen}
                promptEditable={canEditPrompt}
                onPromptDoubleTap={openPromptEditor}
                onPromptDraftChange={setPromptDraft}
                onPromptSave={savePromptDraft}
                onPromptCancel={cancelPromptDraft}
              />
            </div>

            {/* Timer centered in seconds. Double-tap to type duration when idle. */}
            <div className="flex flex-col items-center gap-1">
              {timeEditorOpen ? (
                <div className="flex flex-col items-center gap-1">
                  <input
                    ref={timeInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={timeDraft}
                    onChange={(e) => setTimeDraft(e.target.value)}
                    onBlur={saveTimeDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveTimeDraft();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelTimeDraft();
                      }
                    }}
                    className={`w-[170px] bg-transparent p-0 text-center font-mono text-[36px] leading-none font-bold tracking-[2px] outline-none md:text-[52px] ${timerColor}`}
                  />
                </div>
              ) : (
                <div
                  role={canEditTime ? "button" : undefined}
                  tabIndex={canEditTime ? 0 : undefined}
                  title={
                    canEditTime
                      ? "Double-tap to set seconds (" +
                        TIMER_MIN_SECONDS +
                        " to " +
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
              )}
              {canEditTime && !timeEditorOpen && (
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase ${
                    cameraOn
                      ? "text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]"
                      : "text-slate-700 dark:text-slate-400"
                  }`}
                >
                  Seconds · double-tap to type
                </span>
              )}
            </div>

            {/* Buttons and mobile controls pinned to bottom */}
            <div className="flex w-full flex-col items-center gap-3">
              <div
                className={`flex items-end justify-center gap-3 transition-all duration-500 md:hidden ${
                  inSession
                    ? "pointer-events-none scale-95 opacity-0"
                    : "scale-100 opacity-100"
                }`}
              >
                <div className={toolChromePanel}>
                  <SlotLever onPull={generateTopic} />
                </div>
                <div className={toolChromePanel}>
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
                      className={`cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold backdrop-blur-md transition-opacity hover:opacity-80 ${
                        isPaused
                          ? "border-blue-400/30 bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                          : sessionBtnIdle
                      }`}
                    >
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button onClick={resetTimer} className={sessionBtnIdle}>
                      Reset
                    </button>
                  </>
                )}
                {timerDone && (
                  <>
                    {recordedBlob && (
                      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/35">
                        <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={includePromptOverlay}
                            onChange={(e) =>
                              setIncludePromptOverlay(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Prompt overlay
                        </label>
                        <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={includeTimerOverlay}
                            onChange={(e) =>
                              setIncludeTimerOverlay(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Timer overlay
                        </label>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        resetTimer();
                        generateTopic();
                      }}
                      className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                    >
                      Try Another
                    </button>
                    {(isPreparingDownload || recordedBlob) && (
                      <button
                        onClick={downloadRecording}
                        disabled={!recordedBlob || isExportingVideo}
                        className={`${sessionBtnIdle} ${
                          recordedBlob && !isExportingVideo
                            ? ""
                            : "cursor-default opacity-70 hover:opacity-70"
                        }`}
                      >
                        {isPreparingDownload
                          ? "Preparing video..."
                          : isExportingVideo
                            ? "Exporting video..."
                            : "Download video"}
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
            <div className={toolChromePanel}>
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
            <div className={toolChromePanel}>
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
    </div>
  );
}
