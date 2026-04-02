"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface CompletionScreenProps {
  prompt: string;
  timerSeconds: number;
  cameraOn: boolean;
  micOn: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  isPreparingDownload: boolean;
  onTryAnother: () => void;
  onDownload: () => void;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatTakeDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s take`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0
    ? `${minutes}m take`
    : `${minutes}m ${remainder}s take`;
}

function ReplayPlayer({ src, video = true }: { src: string; video?: boolean }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const trackRef = useRef<HTMLButtonElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const controlGlass =
    "border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-2xl";
  const iconButtonClass = `flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/84 transition-all duration-300 hover:scale-[1.03] hover:text-white ${controlGlass}`;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const syncTime = () => setCurrentTime(media.currentTime);
    const syncDuration = () =>
      setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    const markPlay = () => setIsPlaying(true);
    const markPause = () => setIsPlaying(false);

    media.addEventListener("timeupdate", syncTime);
    media.addEventListener("loadedmetadata", syncDuration);
    media.addEventListener("durationchange", syncDuration);
    media.addEventListener("play", markPlay);
    media.addEventListener("pause", markPause);
    media.addEventListener("ended", markPause);

    return () => {
      media.removeEventListener("timeupdate", syncTime);
      media.removeEventListener("loadedmetadata", syncDuration);
      media.removeEventListener("durationchange", syncDuration);
      media.removeEventListener("play", markPlay);
      media.removeEventListener("pause", markPause);
      media.removeEventListener("ended", markPause);
    };
  }, []);

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const media = mediaRef.current;
      const track = trackRef.current;
      if (!media || !track || duration <= 0) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        Math.max((event.clientX - rect.left) / rect.width, 0),
        1,
      );
      const nextTime = ratio * duration;
      media.currentTime = nextTime;
      setCurrentTime(nextTime);
    };

    const stopScrub = () => {
      setIsScrubbing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
    };
  }, [duration, isScrubbing]);

  const seekFromClientX = (clientX: number) => {
    const media = mediaRef.current;
    const track = trackRef.current;
    if (!media || !track || duration <= 0) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const nextTime = ratio * duration;
    media.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlayback = () => {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) {
      media.play().catch(() => {});
      return;
    }

    media.pause();
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = !media.muted;
    setIsMuted(media.muted);
  };

  const restart = () => {
    const media = mediaRef.current;
    if (!media) return;

    media.currentTime = 0;
    media.play().catch(() => {});
  };

  const enterFullscreen = async () => {
    const media = mediaRef.current;
    if (!media || !video || !("requestFullscreen" in media)) return;

    await (media as HTMLVideoElement).requestFullscreen?.().catch(() => {});
  };

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,19,0.96),rgba(4,6,12,0.98))] shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      {video ? (
        <div className="relative">
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black object-contain"
            onClick={togglePlayback}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(7,10,18,0.58),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(7,10,18,0.82))]" />

          <button
            type="button"
            onClick={togglePlayback}
            className={`absolute inset-0 m-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 hover:scale-[1.04] ${controlGlass}`}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" strokeWidth={2.2} />
            ) : (
              <Play className="ml-1 h-6 w-6" strokeWidth={2.2} />
            )}
          </button>

          <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className={iconButtonClass}
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5" strokeWidth={2.2} />
              ) : (
                <Play className="ml-0.5 h-4.5 w-4.5" strokeWidth={2.2} />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                ref={trackRef}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setIsScrubbing(true);
                  seekFromClientX(event.clientX);
                }}
                className="relative block h-6 w-full cursor-pointer touch-none"
                aria-label="Seek through recording"
              >
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/14" />
                <span
                  className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#ffffff,#b8d8ff)]"
                  style={{ width: `${progress * 100}%` }}
                />
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white shadow-[0_10px_22px_rgba(0,0,0,0.28)]"
                  style={{ left: `${progress * 100}%` }}
                />
              </button>

              <div className="mt-1 flex items-center justify-between text-[12px] font-medium text-white/54">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className={iconButtonClass}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>

            <button type="button" onClick={restart} className={iconButtonClass}>
              <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={enterFullscreen}
              className={iconButtonClass}
            >
              <Expand className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-7 px-6 py-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-white/42 uppercase">
              Audio Replay
            </p>
            <h3 className="font-display text-[30px] leading-none font-semibold tracking-[-0.05em] text-white">
              Listen before you save.
            </h3>
          </div>

          <div className="flex h-[120px] items-end justify-between gap-2">
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                className="w-full rounded-full bg-[linear-gradient(180deg,rgba(110,231,183,0.92),rgba(59,130,246,0.28))]"
                style={{
                  height: `${22 + ((index * 29) % 74)}px`,
                  opacity: 0.25 + (index % 5) * 0.13,
                }}
              />
            ))}
          </div>

          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={src}
            preload="metadata"
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className={iconButtonClass}
            >
              {isPlaying ? (
                <Pause className="h-4.5 w-4.5" strokeWidth={2.2} />
              ) : (
                <Play className="ml-0.5 h-4.5 w-4.5" strokeWidth={2.2} />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                ref={trackRef}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setIsScrubbing(true);
                  seekFromClientX(event.clientX);
                }}
                className="relative block h-6 w-full cursor-pointer touch-none"
                aria-label="Seek through recording"
              >
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/14" />
                <span
                  className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#ffffff,#b8d8ff)]"
                  style={{ width: `${progress * 100}%` }}
                />
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white shadow-[0_10px_22px_rgba(0,0,0,0.28)]"
                  style={{ left: `${progress * 100}%` }}
                />
              </button>

              <div className="mt-1 flex items-center justify-between text-[12px] font-medium text-white/54">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className={iconButtonClass}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>

            <button type="button" onClick={restart} className={iconButtonClass}>
              <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompletionScreen({
  prompt,
  timerSeconds,
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
  const canShowDownload =
    expectsRecording && (isPreparingDownload || hasRecording);

  return (
    <>
      <style>{`
        @keyframes completion-enter {
          from { opacity: 0; transform: translateY(18px) scale(0.988); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="absolute inset-0 z-30 overflow-y-auto rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,rgba(4,7,14,0.56),rgba(4,7,14,0.76))] px-4 py-4 backdrop-blur-sm md:px-8 md:py-6">
        <div className="relative mx-auto flex h-full min-h-full w-full max-w-[1040px] items-center justify-center">
          <div
            className="flex h-full w-full items-stretch rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,10,18,0.94),rgba(5,8,15,0.96))] p-4 shadow-[0_36px_120px_rgba(0,0,0,0.3)] md:max-h-[min(92%,720px)] md:p-6"
            style={{
              animation:
                "completion-enter 0.42s cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <div className="grid h-full w-full gap-4 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] md:gap-6">
              <div className="flex min-h-0 flex-col justify-between rounded-[28px] border border-white/8 bg-white/[0.02] p-5 md:p-6">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/68 uppercase backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]" />
                    Review your take
                  </div>

                  <div className="space-y-3">
                    <h2 className="font-display text-[34px] leading-[0.94] font-semibold tracking-[-0.055em] text-white md:text-[54px]">
                      Watch it back.
                    </h2>
                    <p className="max-w-[320px] text-[15px] leading-relaxed text-white/56">
                      Replay the take, check your energy and pacing, then keep
                      it or move straight into another round.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-white/32 uppercase">
                      Your prompt
                    </p>
                    <p className="text-[20px] leading-snug font-medium text-white/92">
                      {prompt}
                    </p>
                  </div>

                  <div className="inline-flex w-fit items-center rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/74 backdrop-blur-xl">
                    {formatTakeDuration(timerSeconds)}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="max-w-[320px] text-[13px] leading-relaxed text-white/42">
                    Download it if you want to study it later. Otherwise keep
                    the momentum and run another take immediately.
                  </p>

                  <div className="flex flex-col gap-3">
                    {canShowDownload && (
                      <button
                        type="button"
                        onClick={onDownload}
                        disabled={isPreparingDownload || !recordedBlob}
                        className="cursor-pointer rounded-full bg-[linear-gradient(135deg,#3b82f6,#2f6df6_44%,#38bdf8)] px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_16px_38px_rgba(37,99,235,0.34)] transition-all duration-300 hover:scale-[1.01] hover:opacity-96 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPreparingDownload
                          ? "Preparing..."
                          : hasVideo
                            ? "Download video"
                            : "Download audio"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onTryAnother}
                      className="cursor-pointer rounded-full border border-white/14 bg-white/[0.04] px-7 py-3.5 text-[14px] font-semibold text-white/76 backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] hover:opacity-92"
                    >
                      Try another
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                {hasVideo && recordedUrl ? (
                  <div className="flex h-full min-h-0 items-center">
                    <div className="w-full">
                      <ReplayPlayer src={recordedUrl} video />
                    </div>
                  </div>
                ) : hasAudioOnly && recordedUrl ? (
                  <div className="flex h-full min-h-0 items-center">
                    <div className="w-full">
                      <ReplayPlayer src={recordedUrl} video={false} />
                    </div>
                  </div>
                ) : expectsRecording ? (
                  <div className="flex h-full items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="w-full space-y-3">
                      <div className="h-[280px] animate-pulse rounded-[22px] bg-white/6" />
                      <div className="h-4 w-32 animate-pulse rounded-full bg-white/8" />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-12 text-center">
                    <p className="mx-auto max-w-[320px] text-[15px] leading-relaxed text-white/56">
                      Turn on camera or mic if you want a replay here next time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
