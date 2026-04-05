"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Share2 } from "lucide-react";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPlayerTime,
} from "@/components/ui/audio-player";
import { Waveform } from "@/components/ui/waveform";

interface CompletionScreenProps {
  prompt: string;
  timerSeconds?: number;
  cameraOn: boolean;
  micOn: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  isPreparingDownload: boolean;
  onTryAnother: () => void;
  onDownload: () => void;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Waveform data extraction                                          */
/* ------------------------------------------------------------------ */

function useWaveformData(blob: Blob | null, barCount = 100) {
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;

    (async () => {
      try {
        const buf = await blob.arrayBuffer();
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(buf);
        const ch = audio.getChannelData(0);
        const block = Math.floor(ch.length / barCount);
        const bars: number[] = [];
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const start = i * block;
          for (let j = 0; j < block; j++) sum += Math.abs(ch[start + j]);
          bars.push(sum / block);
        }
        const max = Math.max(...bars, 0.01);
        if (!cancelled) setData(bars.map((v) => v / max));
        await ctx.close();
      } catch {
        if (!cancelled)
          setData(
            Array.from({ length: barCount }, () => 0.1 + Math.random() * 0.5),
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, barCount]);

  return data;
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
  onTryAnother,
  canDownload,
  isPreparingDownload,
}: {
  src: string;
  prompt: string;
  onShare: () => void;
  onDownload: () => void;
  onTryAnother: () => void;
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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const handleTap = () => {
    if (!playing) return;
    if (overlayVisible) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setOverlayVisible(false);
    } else {
      setOverlayVisible(true);
      scheduleHide();
    }
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
    <div className="absolute inset-0 flex flex-col">
      {/* Video fills entire container */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full bg-black object-contain"
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
        className={`absolute inset-0 z-20 m-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 ${glass} ${show ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
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
              onClick={onTryAnother}
              className={iconBtn}
              title="Try another"
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
  waveformData,
  onShare,
  onDownload,
  onTryAnother,
  canDownload,
  isPreparingDownload,
}: {
  src: string;
  waveformData: number[];
  onShare: () => void;
  onDownload: () => void;
  onTryAnother: () => void;
  canDownload: boolean;
  isPreparingDownload: boolean;
}) {
  const player = useAudioPlayer();
  const currentTime = useAudioPlayerTime();
  const scrubRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const duration = player.duration ?? 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  useEffect(() => {
    if (!player.activeItem) {
      player.play({ id: "replay", src });
    }
  }, [player, src]);

  const seekFromX = useCallback(
    (clientX: number) => {
      const el = scrubRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min((clientX - rect.left) / rect.width, 1),
      );
      player.seek(ratio * duration);
    },
    [duration, player],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => seekFromX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, seekFromX]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Waveform scrubber */}
      <div
        ref={scrubRef}
        className="relative w-full max-w-[400px] cursor-pointer select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
          const wasPlaying = player.isPlaying;
          player.pause();
          seekFromX(e.clientX);
          if (wasPlaying) {
            const up = () => {
              player.play();
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointerup", up);
          }
        }}
      >
        <Waveform
          data={waveformData}
          height={64}
          barWidth={3}
          barGap={2}
          barRadius={2}
          barColor="rgba(255,255,255,0.22)"
          fadeEdges={false}
        />
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
        >
          <Waveform
            data={waveformData}
            height={64}
            barWidth={3}
            barGap={2}
            barRadius={2}
            barColor="rgba(255,255,255,0.82)"
            fadeEdges={false}
          />
        </div>
      </div>

      {/* Time + progress bar */}
      <div className="flex w-full max-w-[400px] items-center gap-3">
        <span className="text-[11px] text-white/50 tabular-nums">
          {formatTime(currentTime)}
        </span>
        <div
          className="relative h-1 min-w-0 flex-1 cursor-pointer rounded-full bg-white/14"
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
            seekFromX(e.clientX);
          }}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-white/80"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-white/50 tabular-nums">
          {formatTime(duration)}
        </span>
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
      </div>

      {/* Try another */}
      <button
        type="button"
        onClick={onTryAnother}
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Try another
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CompletionScreen                                             */
/* ------------------------------------------------------------------ */

export default function CompletionScreen({
  prompt,
  cameraOn,
  micOn,
  recordedBlob,
  recordedUrl,
  isPreparingDownload,
  onTryAnother,
  onDownload,
}: CompletionScreenProps) {
  const hasVideo = !!recordedUrl && cameraOn;
  const hasAudioOnly = !!recordedUrl && !cameraOn && micOn;
  const hasRecording = hasVideo || hasAudioOnly;
  const expectsRecording = cameraOn || micOn;
  const canDownload = expectsRecording && (isPreparingDownload || hasRecording);

  const waveformData = useWaveformData(hasAudioOnly ? recordedBlob : null);

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
        className="absolute inset-0 z-30 rounded-[inherit] bg-black/95"
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
            onTryAnother={onTryAnother}
            canDownload={canDownload}
            isPreparingDownload={isPreparingDownload}
          />
        )}

        {/* ── Audio-only mode ── */}
        {hasAudioOnly && recordedUrl && (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="mb-8 max-w-[360px] text-center text-[15px] leading-snug font-medium text-white/70">
              {prompt}
            </p>
            <AudioPlayerProvider>
              <AudioReplayControls
                src={recordedUrl}
                waveformData={waveformData}
                onShare={handleShare}
                onDownload={onDownload}
                onTryAnother={onTryAnother}
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
              <>
                <p className="max-w-[260px] text-center text-[15px] leading-relaxed text-white/40">
                  Enable camera or mic before your session to replay it here.
                </p>
                <button
                  type="button"
                  onClick={onTryAnother}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/6 px-6 py-3 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/12"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try another
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
