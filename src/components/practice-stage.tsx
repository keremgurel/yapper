import { CATEGORIES, DIFFICULTIES, type Topic } from "@/data/topics";
import {
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  formatSecondsDisplay,
} from "@/lib/practice-helpers";
import RotaryKnob from "@/components/RotaryKnob";
import SlotLever from "@/components/SlotLever";
import TopicReel from "@/components/TopicReel";
import { MeshGradient } from "@paper-design/shaders-react";

interface PracticeStageProps {
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
  category: string;
  difficulty: string;
  timerSeconds: number;
  timeLeft: number;
  customPromptText: string | null;
  promptDraft: string;
  promptEditorOpen: boolean;
  timeEditorOpen: boolean;
  timeDraft: string;
  isRunning: boolean;
  isPaused: boolean;
  timerDone: boolean;
  cameraOn: boolean;
  micOn: boolean;
  isRecording: boolean;
  recordedBlob: Blob | null;
  isPreparingDownload: boolean;
  includePromptOverlay: boolean;
  includeTimerOverlay: boolean;
  isExportingVideo: boolean;
  inSession: boolean;
  canEditPrompt: boolean;
  canEditTime: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timeInputRef: React.RefObject<HTMLInputElement | null>;
  onCategoryChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onPromptEditStart: () => void;
  onPromptDraftChange: (value: string) => void;
  onPromptSave: () => void;
  onPromptCancel: () => void;
  onTimeEditStart: () => void;
  onTimeDraftChange: (value: string) => void;
  onTimeSave: () => void;
  onTimeCancel: () => void;
  onTimeDoubleClick: (event: React.MouseEvent) => void;
  onTimeTouchEnd: (event: React.TouchEvent) => void;
  onGenerateTopic: () => void;
  onKnobChange: (value: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onDownloadRecording: () => void;
  onPromptOverlayToggle: (value: boolean) => void;
  onTimerOverlayToggle: (value: boolean) => void;
}

export default function PracticeStage({
  topic,
  spinning,
  reelBlurbs,
  category,
  difficulty,
  timerSeconds,
  timeLeft,
  customPromptText,
  promptDraft,
  promptEditorOpen,
  timeEditorOpen,
  timeDraft,
  isRunning,
  isPaused,
  timerDone,
  cameraOn,
  micOn,
  isRecording,
  recordedBlob,
  isPreparingDownload,
  includePromptOverlay,
  includeTimerOverlay,
  isExportingVideo,
  inSession,
  canEditPrompt,
  canEditTime,
  videoRef,
  timeInputRef,
  onCategoryChange,
  onDifficultyChange,
  onPromptEditStart,
  onPromptDraftChange,
  onPromptSave,
  onPromptCancel,
  onTimeEditStart,
  onTimeDraftChange,
  onTimeSave,
  onTimeCancel,
  onTimeDoubleClick,
  onTimeTouchEnd,
  onGenerateTopic,
  onKnobChange,
  onStart,
  onPause,
  onReset,
  onMicToggle,
  onCameraToggle,
  onDownloadRecording,
  onPromptOverlayToggle,
  onTimerOverlayToggle,
}: PracticeStageProps) {
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

  const timerColor =
    timeLeft <= 10
      ? "text-red-600 dark:text-red-500"
      : timeLeft <= 30
        ? "text-amber-600 dark:text-amber-500"
        : cameraOn
          ? "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
          : "text-slate-900 dark:text-white";

  return (
    <main
      id="practice"
      className="relative flex flex-1 flex-col items-center justify-center overflow-visible px-4 pt-0 pb-16 md:pt-2 md:pb-20"
    >
      <div className="shadow-container relative h-[min(90svh,860px)] max-h-[calc(100svh-100px)] w-full max-w-[min(1200px,100%)] overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-100 md:aspect-[16/9] md:h-auto md:max-h-[calc(100vh-200px)] dark:border-white/[0.08] dark:bg-[oklch(0.16_0_0)] dark:bg-none">
        {cameraOn && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

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

        {cameraOn && <div className="absolute inset-0 bg-black/30" />}

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
              onChange={(e) => onCategoryChange(e.target.value)}
              className={selectClass}
            >
              {["All", ...CATEGORIES].map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All Topics" : option}
                </option>
              ))}
            </select>

            <select
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value)}
              className={selectClass}
            >
              {["All", ...DIFFICULTIES].map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All Levels" : option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              onClick={onMicToggle}
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
              onClick={onCameraToggle}
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

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pt-20 pb-4 md:px-6 md:pt-4">
          <div className="w-full max-w-[560px]">
            <TopicReel
              topic={topic}
              spinning={spinning}
              reelBlurbs={reelBlurbs}
              promptOverride={customPromptText}
              promptDraft={promptDraft}
              promptEditing={promptEditorOpen}
              promptEditable={canEditPrompt}
              onPromptDoubleTap={onPromptEditStart}
              onPromptDraftChange={onPromptDraftChange}
              onPromptSave={onPromptSave}
              onPromptCancel={onPromptCancel}
            />
          </div>

          <div className="flex flex-col items-center gap-1">
            {timeEditorOpen ? (
              <div className="flex flex-col items-center gap-1">
                <input
                  ref={timeInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={timeDraft}
                  onChange={(e) => onTimeDraftChange(e.target.value)}
                  onBlur={onTimeSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onTimeSave();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onTimeCancel();
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
                    ? `Double-tap to set seconds (${TIMER_MIN_SECONDS} to ${TIMER_MAX_SECONDS})`
                    : undefined
                }
                onDoubleClick={onTimeDoubleClick}
                onTouchEnd={onTimeTouchEnd}
                onKeyDown={(e) => {
                  if (
                    canEditTime &&
                    (e.key === "Enter" || e.key === " ") &&
                    e.target === e.currentTarget
                  ) {
                    e.preventDefault();
                    onTimeEditStart();
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

          <div className="flex w-full flex-col items-center gap-3">
            <div
              className={`flex items-end justify-center gap-3 transition-all duration-500 md:hidden ${
                inSession
                  ? "pointer-events-none scale-95 opacity-0"
                  : "scale-100 opacity-100"
              }`}
            >
              <div className={toolChromePanel}>
                <SlotLever onPull={onGenerateTopic} />
              </div>
              <div className={toolChromePanel}>
                <RotaryKnob
                  value={timerSeconds}
                  onChange={onKnobChange}
                  min={TIMER_MIN_SECONDS}
                  max={TIMER_MAX_SECONDS}
                  disabled={isRunning}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {!isRunning && !timerDone && (
                <button
                  onClick={onStart}
                  className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                >
                  Start
                </button>
              )}

              {isRunning && (
                <>
                  <button
                    onClick={onPause}
                    className={`cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold backdrop-blur-md transition-opacity hover:opacity-80 ${
                      isPaused
                        ? "border-blue-400/30 bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                        : sessionBtnIdle
                    }`}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button onClick={onReset} className={sessionBtnIdle}>
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
                            onPromptOverlayToggle(e.target.checked)
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
                            onTimerOverlayToggle(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Timer overlay
                      </label>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      onReset();
                      onGenerateTopic();
                    }}
                    className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                  >
                    Try Another
                  </button>

                  {(isPreparingDownload || recordedBlob) && (
                    <button
                      onClick={onDownloadRecording}
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

        <div
          className={`absolute bottom-4 left-4 z-10 hidden transition-all duration-500 md:block ${
            inSession
              ? "pointer-events-none scale-90 opacity-0"
              : "scale-100 opacity-100"
          }`}
        >
          <div className={toolChromePanel}>
            <SlotLever onPull={onGenerateTopic} />
          </div>
        </div>

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
              onChange={onKnobChange}
              min={TIMER_MIN_SECONDS}
              max={TIMER_MAX_SECONDS}
              disabled={isRunning}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
