"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Download, Pause, Play, RotateCcw, Share2 } from "lucide-react";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  AudioPlayerProgress,
  AudioPlayerTime,
  AudioPlayerDuration,
} from "@/components/ui/audio-player";
import { usePracticeSession } from "@/contexts/practice-session";
import {
  trackRecordingDownloaded,
  trackRecordingShared,
} from "@/lib/analytics";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Shared                                                            */
/* ------------------------------------------------------------------ */

const glass =
  "border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-2xl";

const iconBtn = `flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/84 transition-all duration-200 hover:text-white active:scale-95 ${glass}`;

/* ------------------------------------------------------------------ */
/*  Video player – full-bleed with overlay                            */
/* ------------------------------------------------------------------ */

function VideoPlayer({
  src,
  prompt,
  onShare,
  onDownload,
  onNewSession,
  canDownload,
  isPreparingDownload,
}: {
  src: string;
  prompt: string;
  onShare: () => void;
  onDownload: () => void;
  onNewSession: () => void;
  canDownload: boolean;
  isPreparingDownload: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const progress = duration > 0 ? Math.min(time / duration, 1) : 0;

  /* --- media event listeners --- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setTime(v.currentTime);
    const onDur = () =>
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setOverlayVisible(true);
    };
    // If metadata is already loaded, grab the duration immediately
    onDur();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
    };
  }, []);

  /* --- auto-hide overlay --- */
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setOverlayVisible(false), 2200);
  }, []);

  useEffect(() => {
    if (playing && !scrubbing) {
      scheduleHide();
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, scrubbing, scheduleHide]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  /* --- spacebar play/pause --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  const isTouchRef = useRef(false);

  const handleTap = () => {
    // On touch devices: first tap reveals overlay, second tap toggles play.
    // On desktop (mouse): always toggle play since hover shows overlay.
    if (isTouchRef.current && playing && !overlayVisible) {
      setOverlayVisible(true);
      scheduleHide();
      return;
    }

    togglePlay();
    setOverlayVisible(true);
    if (!playing) {
      scheduleHide();
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  };

  const handlePointerMove = () => {
    if (!playing) return;
    setOverlayVisible(true);
    scheduleHide();
  };

  const handlePointerLeave = () => {
    if (!playing || scrubbing) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setOverlayVisible(false);
  };

  /* --- scrubbing --- */
  const seekFromX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      const v = videoRef.current;
      if (!el || !v || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min((clientX - rect.left) / rect.width, 1),
      );
      v.currentTime = ratio * duration;
      setTime(v.currentTime);
    },
    [duration],
  );

  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => seekFromX(e.clientX);
    const up = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [scrubbing, seekFromX]);

  const show = overlayVisible;

  return (
    <div
      className="absolute inset-0 flex flex-col"
      onPointerDown={(e) => {
        if (e.pointerType === "touch") isTouchRef.current = true;
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Video fills entire container */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full -scale-x-100 bg-black object-contain"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") isTouchRef.current = true;
        }}
        onClick={handleTap}
      />

      {/* Top gradient */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0.7),transparent)] transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
      />

      {/* Bottom gradient */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.8))] transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
      />

      {/* Prompt overlay – top */}
      <div
        className={`absolute inset-x-0 top-0 z-20 p-5 transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
      >
        <p className="max-w-[480px] text-[14px] leading-snug font-medium text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-[16px]">
          {prompt}
        </p>
      </div>

      {/* Center play button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
          if (!playing) scheduleHide();
        }}
        className={`absolute inset-0 z-20 m-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 outline-none ${glass} ${show ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
      >
        {playing ? (
          <Pause className="h-6 w-6" strokeWidth={2.2} />
        ) : (
          <Play className="ml-1 h-6 w-6" strokeWidth={2.2} />
        )}
      </button>

      {/* Bottom bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-4 transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
      >
        {/* Scrub bar */}
        <div
          ref={trackRef}
          className="relative h-6 w-full cursor-pointer touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            setScrubbing(true);
            seekFromX(e.clientX);
          }}
        >
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20" />
          <span
            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-white"
            style={{ width: `${progress * 100}%` }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white shadow-md"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/60 tabular-nums">
            {formatTime(time)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-2">
            {canDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={isPreparingDownload}
                className={`${iconBtn} disabled:opacity-40`}
                title="Download"
              >
                <Download className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
            <button
              type="button"
              onClick={onShare}
              className={iconBtn}
              title="Share"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={onNewSession}
              className={`${iconBtn} md:hidden`}
              title="New Session"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Audio player – centred waveform                                   */
/* ------------------------------------------------------------------ */

function AudioReplayControls({
  src,
  onShare,
  onDownload,
  onNewSession,
  canDownload,
  isPreparingDownload,
}: {
  src: string;
  onShare: () => void;
  onDownload: () => void;
  onNewSession: () => void;
  canDownload: boolean;
  isPreparingDownload: boolean;
}) {
  const player = useAudioPlayer();

  useEffect(() => {
    if (!player.activeItem) {
      player.play({ id: "replay", src });
    }
  }, [player, src]);

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
      {/* Progress slider */}
      <AudioPlayerProgress className="w-full" />

      {/* Time labels */}
      <div className="flex w-full items-center justify-between">
        <AudioPlayerTime className="text-[12px] text-white/50" />
        <AudioPlayerDuration className="text-[12px] text-white/50" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {canDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={isPreparingDownload}
            className={`${iconBtn} disabled:opacity-40`}
            title="Download"
          >
            <Download className="h-4 w-4" strokeWidth={2.2} />
          </button>
        )}

        <button
          type="button"
          onClick={() => (player.isPlaying ? player.pause() : player.play())}
          className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-200 active:scale-95 ${glass}`}
        >
          {player.isPlaying ? (
            <Pause className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Play className="ml-0.5 h-5 w-5" strokeWidth={2.2} />
          )}
        </button>

        <button
          type="button"
          onClick={onShare}
          className={iconBtn}
          title="Share"
        >
          <Share2 className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onNewSession}
          className={iconBtn}
          title="New Session"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CompletionScreen                                             */
/* ------------------------------------------------------------------ */

export default function CompletionScreen() {
  const {
    mode,
    topic,
    customPromptText,
    cameraOn,
    micOn,
    recordedBlob,
    recordedUrl,
    isPreparingDownload,
    downloadRecording,
    resetTimer,
    generateTopic,
  } = usePracticeSession();

  const isFreestyle = mode === "freestyle";
  const prompt = isFreestyle
    ? "Freestyle session"
    : (customPromptText ?? topic.text);
  const onDownload = () => {
    downloadRecording();
    trackRecordingDownloaded({ hasVideo: cameraOn });
  };
  const onNewSession = () => {
    resetTimer();
    if (!isFreestyle) generateTopic();
  };
  const hasVideo = !!recordedUrl && cameraOn;
  const hasAudioOnly = !!recordedUrl && !cameraOn && micOn;
  const hasRecording = hasVideo || hasAudioOnly;
  const expectsRecording = cameraOn || micOn;
  const canDownload = expectsRecording && (isPreparingDownload || hasRecording);

  const handleShare = async () => {
    if (!recordedUrl || !recordedBlob) return;
    try {
      const file = new File([recordedBlob], "yapper-take.webm", {
        type: recordedBlob.type,
      });
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: "My Yapper Take",
          text: `Check out my practice take on: "${prompt}"`,
        });
        trackRecordingShared();
      }
    } catch {
      /* user cancelled share */
    }
  };

  return (
    <>
      <style>{`
        @keyframes completion-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div
        className="absolute inset-0 z-30 rounded-[inherit] bg-black/60 backdrop-blur-3xl"
        style={{
          animation: "completion-fade-in 0.35s cubic-bezier(.22,1,.36,1) both",
        }}
      >
        {/* ── Video mode ── */}
        {hasVideo && recordedUrl && (
          <VideoPlayer
            src={recordedUrl}
            prompt={prompt}
            onShare={handleShare}
            onDownload={onDownload}
            onNewSession={onNewSession}
            canDownload={canDownload}
            isPreparingDownload={isPreparingDownload}
          />
        )}

        {/* ── Audio-only mode ── */}
        {hasAudioOnly && recordedUrl && (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="mb-8 max-w-[460px] text-center text-[20px] leading-snug font-semibold text-white/80">
              {prompt}
            </p>
            <AudioPlayerProvider>
              <AudioReplayControls
                src={recordedUrl}
                onShare={handleShare}
                onDownload={onDownload}
                onNewSession={onNewSession}
                canDownload={canDownload}
                isPreparingDownload={isPreparingDownload}
              />
            </AudioPlayerProvider>
          </div>
        )}

        {/* ── No recording / preparing ── */}
        {!hasRecording && (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
            {expectsRecording ? (
              <>
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                <p className="text-[14px] text-white/40">
                  Preparing your recording...
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/50"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <p className="text-[22px] font-semibold text-white/80">
                    Session complete
                  </p>
                  <p className="max-w-[400px] text-center text-[17px] leading-relaxed text-white/45">
                    &ldquo;{prompt}&rdquo;
                  </p>
                </div>

                <p className="text-[14px] text-white/30">
                  Enable camera or mic to save a replay
                </p>

                <button
                  type="button"
                  onClick={onNewSession}
                  className="mt-2 flex cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/6 px-7 py-3.5 text-[15px] font-semibold text-white/80 transition-colors hover:bg-white/12"
                >
                  <RotateCcw className="h-4 w-4" />
                  New Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
