import { CATEGORIES, DIFFICULTIES, type Topic } from "@/data/topics";
import {
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  formatSecondsDisplay,
} from "@/lib/practice-helpers";
import RotaryKnob from "@/components/RotaryKnob";
import SlotLever from "@/components/SlotLever";
import TopicReel from "@/components/TopicReel";
import CompletionScreen from "@/components/CompletionScreen";
import PracticeSettingsPanel from "@/components/practice-settings-panel";
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
  videoFormat: "portrait" | "landscape";
  isCompactDevice: boolean;
  settingsOpen: boolean;
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
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onFormatChange: (format: "portrait" | "landscape") => void;
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
  videoFormat,
  isCompactDevice,
  settingsOpen,
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
  onOpenSettings,
  onCloseSettings,
  onFormatChange,
  onPromptOverlayToggle,
  onTimerOverlayToggle,
}: PracticeStageProps) {
  const toolChromePanel =
    "rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-black/45 dark:shadow-none";

  const selectClass =
    "min-w-0 flex-1 cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] outline-none backdrop-blur-xl sm:flex-none " +
    (cameraOn
      ? "border-white/12 bg-black/42 text-white"
      : "border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/40 dark:text-white");

  const sessionBtnIdle =
    "cursor-pointer rounded-full border px-5 py-2.5 text-[13px] font-semibold backdrop-blur-xl transition-opacity hover:opacity-80 " +
    (cameraOn
      ? "border-white/12 bg-black/42 text-white"
      : "border-slate-200 bg-white/95 text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/40 dark:text-white");
  const toolbarIconButtonClass =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300 " +
    (cameraOn
      ? "border-white/12 bg-black/42 text-white hover:bg-black/52"
      : "border-slate-200 bg-white/95 text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-white/22 dark:text-white dark:hover:bg-white/28");

  const timerColor =
    timeLeft <= 10
      ? "text-red-600 dark:text-red-500"
      : timeLeft <= 30
        ? "text-amber-600 dark:text-amber-500"
        : cameraOn
          ? "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]"
          : "text-slate-900 dark:text-white";
  const stageFrameClass = isCompactDevice
    ? "aspect-[9/16] w-[min(calc(100vw-2rem),calc((100dvh-1.5rem)*9/16))] max-h-[calc(100dvh-1.5rem)] lg:w-[min(calc((100vh-200px)*9/16),100%)]"
    : "aspect-[16/9] w-full max-w-[min(1200px,100%)] max-h-[calc(100dvh-1.5rem)] md:h-auto md:max-h-[calc(100vh-200px)]";
  const recordingViewportClass =
    videoFormat === "portrait"
      ? "aspect-[9/16] h-full max-h-full w-auto max-w-full"
      : "aspect-[16/9] h-auto max-h-full w-full";
  const showPromptInLiveStage = includePromptOverlay || !inSession || !cameraOn;
  const showTimerInLiveStage = includeTimerOverlay || !inSession || !cameraOn;

  return (
    <main
      id="practice"
      className="relative flex flex-1 flex-col items-center justify-start overflow-visible px-4 pt-0 pb-6 sm:pb-16 md:justify-center md:pt-2 md:pb-20"
    >
      <div
        className={`shadow-container relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-100 dark:border-white/[0.08] dark:bg-[oklch(0.16_0_0)] dark:bg-none ${stageFrameClass}`}
      >
        <div className="absolute inset-0">
          <MeshGradient
            className="absolute inset-0 h-full w-full"
            colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
            speed={0.3}
            distortion={0.4}
            swirl={0.3}
          />
        </div>

        {cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={recordingViewportClass}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full bg-black object-contain"
              />
            </div>
          </div>
        )}

        {cameraOn && <div className="absolute inset-0 bg-black/18" />}

        <div className="absolute inset-x-4 top-4 z-50 flex items-start justify-between gap-3">
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

          <div className="relative z-50 flex shrink-0 gap-2">
            <button
              onClick={onMicToggle}
              className={
                micOn
                  ? toolbarIconButtonClass
                  : "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-red-400/40 bg-red-500 text-white backdrop-blur-md transition-all duration-200 hover:bg-red-400"
              }
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
              className={
                cameraOn
                  ? toolbarIconButtonClass
                  : "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-red-400/40 bg-red-500 text-white backdrop-blur-md transition-all duration-200 hover:bg-red-400"
              }
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

            <button
              onClick={settingsOpen ? onCloseSettings : onOpenSettings}
              disabled={inSession}
              className={`${toolbarIconButtonClass} ${inSession ? "cursor-not-allowed opacity-45 hover:bg-inherit" : ""}`}
              aria-label={
                settingsOpen
                  ? "Close recording settings"
                  : "Open recording settings"
              }
              title={
                settingsOpen ? "Close recording settings" : "Recording settings"
              }
            >
              {settingsOpen ? (
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4.6H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.49.68.99 1.51 1H21a2 2 0 1 1 0 4h-.09c-.83.01-1.31.52-1.51 1Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pt-20 pb-4 md:px-6 md:pt-4">
          <div
            className={`w-full max-w-[560px] transition-opacity duration-300 ${
              showPromptInLiveStage
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
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

          <div
            className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${
              showTimerInLiveStage
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
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
                <button
                  onClick={() => {
                    onReset();
                    onGenerateTopic();
                  }}
                  className="cursor-pointer rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                >
                  Try Another
                </button>
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

        {/* Completion screen overlay */}
        {timerDone && (
          <CompletionScreen
            prompt={customPromptText ?? topic.text}
            timerSeconds={timerSeconds}
            cameraOn={cameraOn}
            micOn={micOn}
            recordedBlob={recordedBlob}
            isPreparingDownload={isPreparingDownload}
            onTryAnother={() => {
              onReset();
              onGenerateTopic();
            }}
            onDownload={onDownloadRecording}
          />
        )}

        <PracticeSettingsPanel
          open={settingsOpen}
          videoFormat={videoFormat}
          includePromptOverlay={includePromptOverlay}
          includeTimerOverlay={includeTimerOverlay}
          isCompactDevice={isCompactDevice}
          onFormatChange={onFormatChange}
          onPromptOverlayToggle={onPromptOverlayToggle}
          onTimerOverlayToggle={onTimerOverlayToggle}
        />
      </div>
    </main>
  );
}
