"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Expand,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";

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

function ReplayPlayer({
  src,
  video = true,
  onShare,
}: {
  src: string;
  video?: boolean;
  onShare?: () => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const trackRef = useRef<HTMLButtonElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [isInteracting, setIsInteracting] = useState(true);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const controlGlass =
    "border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-2xl";
  const iconButtonClass = `flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/84 transition-all duration-300 hover:scale-[1.03] hover:text-white ${controlGlass}`;

  const resetInteractionTimer = () => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 2500);
  };

  useEffect(() => {
    // Start the hide timer if playing, scrubbing stops, or speed menu closes
    if (isPlaying && !isScrubbing && !showSpeedMenu) {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      interactionTimeoutRef.current = setTimeout(() => {
        setIsInteracting(false);
      }, 2500);
    } else {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    }
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [isPlaying, isScrubbing, showSpeedMenu]);

  const handlePointerMove = () => {
    if (isPlaying && !isScrubbing && !showSpeedMenu) {
      resetInteractionTimer();
    } else {
      setIsInteracting(true);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isScrubbing && !showSpeedMenu) {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      setIsInteracting(false);
    }
  };

  const handlePlayerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isPlaying) {
        if (isInteracting) {
          if (interactionTimeoutRef.current)
            clearTimeout(interactionTimeoutRef.current);
          setIsInteracting(false);
        } else {
          resetInteractionTimer();
        }
      }
    }
  };

  const showControls =
    !isPlaying || isScrubbing || showSpeedMenu || isInteracting;

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
    if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMoveGlobal = (event: PointerEvent) => {
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

    window.addEventListener("pointermove", handlePointerMoveGlobal);
    window.addEventListener("pointerup", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMoveGlobal);
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
    <div
      onPointerMove={handlePointerMove}
      onMouseLeave={handleMouseLeave}
      className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,11,19,0.96),rgba(4,6,12,0.98))] shadow-[0_26px_80px_rgba(0,0,0,0.28)]"
    >
      {video ? (
        <div className="relative cursor-pointer" onClick={handlePlayerClick}>
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black object-contain"
          />

          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(7,10,18,0.58),transparent)] transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
          />
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(7,10,18,0.82))] transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayback();
            }}
            className={`absolute inset-0 m-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 hover:scale-[1.04] ${controlGlass} ${showControls ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" strokeWidth={2.2} />
            ) : (
              <Play className="ml-1 h-6 w-6" strokeWidth={2.2} />
            )}
          </button>

          <div
            className={`absolute right-4 bottom-4 left-4 flex flex-col gap-3 transition-all duration-300 ${showControls ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayback();
                }}
                className={iconButtonClass}
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5" strokeWidth={2.2} />
                ) : (
                  <Play className="ml-0.5 h-4.5 w-4.5" strokeWidth={2.2} />
                )}
              </button>

              <div
                className="min-w-0 flex-1"
                onClick={(e) => e.stopPropagation()}
              >
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

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(!showSpeedMenu);
                  }}
                  className={`${iconButtonClass} px-3 text-[12px] font-bold`}
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div
                    className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-white/12 bg-slate-900/90 shadow-xl backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`px-4 py-2 text-[12px] font-medium transition-colors hover:bg-white/10 ${
                          playbackRate === rate
                            ? "bg-blue-600 text-white"
                            : "text-white/60"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className={iconButtonClass}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  enterFullscreen();
                }}
                className={`${iconButtonClass} hidden sm:flex`}
              >
                <Expand className="h-4 w-4" strokeWidth={2.2} />
              </button>

              {onShare && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  className={iconButtonClass}
                >
                  <Share2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
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

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`${iconButtonClass} px-3 text-[12px] font-bold`}
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-white/12 bg-slate-900/90 shadow-xl backdrop-blur-xl">
                  {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-4 py-2 text-[12px] font-medium transition-colors hover:bg-white/10 ${
                        playbackRate === rate
                          ? "bg-blue-600 text-white"
                          : "text-white/60"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
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
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  return (
    <>
      <style>{`
        @keyframes completion-enter {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,rgba(4,7,14,0.64),rgba(4,7,14,0.84))] p-3 backdrop-blur-md sm:p-4 md:p-8">
        <div
          className="relative flex h-full max-h-[820px] w-full max-w-[1080px] flex-col overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,15,26,0.96),rgba(7,10,18,0.98))] shadow-[0_48px_140px_rgba(0,0,0,0.5)] md:flex-row"
          style={{
            animation: "completion-enter 0.48s cubic-bezier(.22,1,.36,1) both",
          }}
        >
          {/* Left Column: Info & Actions */}
          <div className="custom-scrollbar flex h-auto flex-col justify-between border-b border-white/8 bg-white/1 p-5 sm:p-6 md:h-full md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] text-emerald-400 uppercase">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                  Review Take
                </div>
                <div className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/60">
                  {formatTakeDuration(timerSeconds)}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-[32px] leading-[1.1] font-bold tracking-tight text-white sm:text-[42px]">
                  Great job.
                </h2>
                <p className="text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                  Take a moment to watch your performance. Look for pacing,
                  clarity, and confidence.
                </p>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/3 p-4 sm:p-5">
                <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-white/30 uppercase">
                  Your prompt
                </p>
                <p className="text-[17px] leading-snug font-semibold text-white/90 sm:text-[19px]">
                  {prompt}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex flex-col gap-3">
                {canShowDownload && (
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={isPreparingDownload || !recordedBlob}
                    className="group relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-blue-600 px-7 py-4 text-[14px] font-bold text-white transition-all duration-300 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>
                      {isPreparingDownload
                        ? "Preparing..."
                        : hasVideo
                          ? "Download video"
                          : "Download audio"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onTryAnother}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-7 py-4 text-[14px] font-bold text-white/80 backdrop-blur-xl transition-all duration-300 hover:bg-white/12 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Try another round</span>
                </button>
              </div>
              <p className="text-center text-[12px] text-white/30">
                Recordings are temporary and not stored.
              </p>
            </div>
          </div>

          {/* Right Column: Player */}
          <div className="flex min-h-0 flex-1 flex-col bg-black/20">
            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
              <div className="mx-auto flex h-full max-w-[720px] flex-col justify-center space-y-8">
                <div>
                  {hasRecording && recordedUrl ? (
                    <ReplayPlayer
                      src={recordedUrl}
                      video={hasVideo}
                      onShare={handleShare}
                    />
                  ) : expectsRecording ? (
                    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[30px] border border-dashed border-white/20 bg-white/2">
                      <div className="mb-4 h-12 w-12 animate-pulse rounded-full bg-white/10" />
                      <p className="text-sm font-medium text-white/40">
                        Preparing your recording...
                      </p>
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-[30px] border border-white/10 bg-white/2 p-8 text-center">
                      <p className="max-w-[280px] text-[15px] leading-relaxed text-white/40">
                        Enable camera or mic to record your take and watch it
                        back here.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-white/5 bg-white/2 p-6 text-center">
                  <p className="text-[14px] leading-relaxed text-white/40">
                    Use this replay to evaluate your pacing and word choice.
                    Practicing consistently is the best way to build speaking
                    confidence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
