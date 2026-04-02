"use client";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
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
        @keyframes completion-fade-up {
          from { opacity: 0; transform: translateY(20px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes completion-glow {
          0%, 100% { opacity: 0.35; transform: scale(0.98); }
          50% { opacity: 0.65; transform: scale(1.02); }
        }
        @keyframes completion-wave {
          0%, 100% { transform: scaleY(0.38); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      <div className="absolute inset-0 z-30 overflow-y-auto rounded-[inherit] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(3,7,18,0.58),rgba(3,7,18,0.84))] px-4 py-6 backdrop-blur-md md:px-6 md:py-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute top-[8%] left-[18%] h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div
            className="absolute right-[12%] bottom-[18%] h-44 w-44 rounded-full bg-blue-500/12 blur-3xl"
            style={{ animation: "completion-glow 4.8s ease-in-out infinite" }}
          />
        </div>

        <div className="relative mx-auto flex min-h-full w-full max-w-[760px] items-center justify-center">
          <div
            className="w-full rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(12,18,34,0.9),rgba(7,11,23,0.82))] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6"
            style={{
              animation:
                "completion-fade-up 0.45s cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="max-w-[430px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/62 uppercase backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
                    Review your take
                  </div>
                  <h2 className="font-display mt-4 text-[31px] leading-[0.96] font-semibold tracking-[-0.05em] text-white md:text-[42px]">
                    Watch it back.
                  </h2>
                  <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-white/58 md:text-[15px]">
                    Replay the take, make sure it feels right, then save it.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-4 py-2 text-white/72 backdrop-blur-xl">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="font-mono text-[14px] font-semibold">
                      {formatDuration(timerSeconds)}
                    </span>
                  </div>

                  {hasRecording && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/10 px-4 py-2 text-emerald-100 backdrop-blur-xl">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">
                        Ready
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-[28px] border border-white/10 bg-black/28 p-3 backdrop-blur-xl md:p-4">
                  <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.9),rgba(5,8,16,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-4">
                    {hasVideo && recordedUrl ? (
                      <video
                        src={recordedUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="max-h-[420px] w-full rounded-[18px] bg-black object-contain"
                      />
                    ) : hasAudioOnly && recordedUrl ? (
                      <div className="flex min-h-[300px] flex-col justify-between rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_28%),linear-gradient(180deg,rgba(10,14,28,0.96),rgba(6,10,20,0.96))] p-6">
                        <div>
                          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/40 uppercase">
                            Audio Replay
                          </p>
                          <h3 className="font-display mt-3 text-[26px] leading-none font-semibold tracking-[-0.04em] text-white">
                            Listen before you save.
                          </h3>
                        </div>

                        <div className="flex h-[120px] items-end justify-center gap-2">
                          {Array.from({ length: 22 }).map((_, index) => (
                            <span
                              key={index}
                              className="w-2 rounded-full bg-[linear-gradient(180deg,rgba(96,165,250,0.96),rgba(255,255,255,0.4))]"
                              style={{
                                height: `${32 + ((index * 19) % 68)}px`,
                                animation: `completion-wave ${1.05 + (index % 4) * 0.15}s ease-in-out ${index * 0.03}s infinite`,
                              }}
                            />
                          ))}
                        </div>

                        <audio
                          src={recordedUrl}
                          controls
                          preload="metadata"
                          className="w-full"
                        />
                      </div>
                    ) : expectsRecording ? (
                      <div className="space-y-4 rounded-[18px] bg-white/5 p-5">
                        <div className="h-[260px] animate-pulse rounded-[18px] bg-white/6" />
                        <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/8" />
                      </div>
                    ) : (
                      <div className="flex min-h-[260px] items-center justify-center rounded-[18px] bg-white/5 px-8 text-center">
                        <p className="max-w-[280px] text-[14px] leading-relaxed text-white/58">
                          Turn on camera or mic if you want a replay here next
                          time.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-white/36 uppercase">
                      Your topic
                    </p>
                    <p className="mt-3 text-[16px] leading-snug font-medium text-white/88">
                      {prompt}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur-xl">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-white/36 uppercase">
                      Next move
                    </p>
                    <p className="mt-3 text-[14px] leading-relaxed text-white/60">
                      Replay it once, check your energy and pacing, then save or
                      run another round immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                {canShowDownload && (
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={isPreparingDownload || !recordedBlob}
                    className="flex-1 cursor-pointer rounded-full bg-[linear-gradient(135deg,#3b82f6,#2f6df6_42%,#38bdf8)] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)] transition-all duration-300 hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPreparingDownload
                      ? "Preparing replay..."
                      : hasVideo
                        ? "Download video"
                        : "Download audio"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onTryAnother}
                  className={`cursor-pointer rounded-full px-6 py-3.5 text-[14px] font-semibold transition-all duration-300 hover:scale-[1.01] hover:opacity-92 ${
                    hasRecording
                      ? "border border-white/14 bg-white/[0.04] text-white/76 backdrop-blur-xl sm:min-w-[180px]"
                      : "flex-1 bg-[linear-gradient(135deg,#3b82f6,#2f6df6_42%,#38bdf8)] text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)]"
                  }`}
                >
                  Try another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
