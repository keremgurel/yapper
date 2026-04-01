"use client";

interface CompletionScreenProps {
  prompt: string;
  timerSeconds: number;
  cameraOn: boolean;
  micOn: boolean;
  recordedBlob: Blob | null;
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
  isPreparingDownload,
  onTryAnother,
  onDownload,
}: CompletionScreenProps) {
  const hasVideo = !!recordedBlob && cameraOn;
  const hasAudioOnly = !!recordedBlob && !cameraOn && micOn;
  const hasRecording = hasVideo || hasAudioOnly;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-[inherit] bg-black/70 backdrop-blur-sm">
      <div className="flex w-full max-w-[340px] flex-col items-center gap-5 px-5">
        {/* Emoji */}
        <div className="animate-cs-pop text-[52px] leading-none">🎉</div>

        {/* Headline */}
        <h2 className="animate-cs-up-delay-1 font-display text-center text-[26px] font-bold tracking-tight text-white">
          Nice work!
        </h2>

        {/* Topic */}
        <div className="animate-cs-up-delay-2 w-full rounded-2xl border border-white/10 bg-white/8 px-5 py-4 text-center">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-white/35 uppercase">
            Your topic
          </p>
          <p className="mt-1.5 text-[15px] leading-snug font-medium text-white/85">
            {prompt}
          </p>
        </div>

        {/* Duration pill */}
        <div className="animate-cs-up-delay-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4 text-white/40"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="font-mono text-[14px] font-semibold text-white/70">
            {formatDuration(timerSeconds)}
          </span>
        </div>

        {/* Buttons */}
        <div className="animate-cs-up-delay-4 flex w-full flex-col gap-2.5">
          {/* Download */}
          {hasRecording && (
            <button
              type="button"
              onClick={onDownload}
              disabled={isPreparingDownload}
              className="w-full cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 py-3 text-[14px] font-semibold text-white shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPreparingDownload
                ? "Preparing..."
                : hasVideo
                  ? "Download Video"
                  : "Download Audio"}
            </button>
          )}

          {/* Try Another */}
          <button
            type="button"
            onClick={onTryAnother}
            className={`w-full cursor-pointer rounded-full py-3 text-[14px] font-semibold transition-opacity hover:opacity-90 ${
              hasRecording
                ? "border border-white/15 text-white/70"
                : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(37,99,235,0.3)]"
            }`}
          >
            Try Another
          </button>
        </div>
      </div>
    </div>
  );
}
