"use client";

import { motion } from "framer-motion";
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
import {
  AnimatedMicIcon,
  AnimatedCameraIcon,
  AnimatedPausePlayIcon,
  AnimatedStopIcon,
  AnimatedResetIcon,
} from "@/components/animated-icons";
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
  recordedUrl: string | null;
  isPreparingDownload: boolean;
  isCompactDevice: boolean;
  hasGeneratedTopic: boolean;
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
  onFinish: () => void;
  onReset: () => void;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onDownloadRecording: () => void;
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
  recordedUrl,
  isPreparingDownload,
  isCompactDevice,
  hasGeneratedTopic,
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
  onFinish,
  onReset,
  onMicToggle,
  onCameraToggle,
  onDownloadRecording,
}: PracticeStageProps) {
  const overlayGlass =
    "border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_20px_44px_rgba(15,23,42,0.18)] backdrop-blur-2xl";
  const toolChromePanel = `rounded-[28px] p-3 ${overlayGlass}`;

  const selectClass = `min-w-0 flex-1 cursor-pointer rounded-2xl px-3 py-2 text-[11px] font-medium text-white outline-none sm:flex-none ${overlayGlass}`;

  const toolbarIconButtonClass = `flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 hover:bg-white/16 ${overlayGlass}`;

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

  return (
    <main
      id="practice"
      className="relative flex flex-1 flex-col items-center justify-start overflow-visible px-4 pt-0 pb-6 sm:pb-16 md:justify-center md:pt-2 md:pb-20"
    >
      <div
        className={`shadow-container relative overflow-hidden rounded-3xl border border-slate-200/90 bg-linear-to-b from-white to-slate-100 dark:border-white/8 dark:bg-[oklch(0.16_0_0)] dark:bg-none ${stageFrameClass}`}
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
          <div className="absolute inset-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full bg-black object-cover"
            />
          </div>
        )}

        {cameraOn && <div className="absolute inset-0 bg-black/18" />}

        <div className="absolute inset-x-4 top-4 z-50 flex items-start justify-between gap-3">
          {isRecording && (
            <div
              className={`absolute top-0 left-0 flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-md md:static md:flex-none ${
                cameraOn ? overlayGlass : overlayGlass
              }`}
            >
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-xs font-semibold">REC</span>
            </div>
          )}

          <div
            className={`flex min-w-0 flex-1 flex-wrap gap-2 pr-20 transition-all duration-500 md:pr-0 ${
              inSession || timerDone
                ? "pointer-events-none opacity-0"
                : "opacity-100"
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

          <div
            className={`relative z-50 flex shrink-0 gap-2 transition-all duration-500 ${timerDone ? "pointer-events-none opacity-0" : ""}`}
          >
            <button
              onClick={onMicToggle}
              disabled={isRecording}
              className={`${
                micOn
                  ? toolbarIconButtonClass
                  : `flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/18 bg-[linear-gradient(180deg,rgba(255,103,103,0.82),rgba(239,68,68,0.68))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_18px_34px_rgba(239,68,68,0.22)] backdrop-blur-2xl transition-all duration-200 hover:opacity-92`
              } ${isRecording ? "cursor-not-allowed opacity-45 hover:bg-inherit" : ""}`}
              title={micOn ? "Mute" : "Unmute"}
            >
              <AnimatedMicIcon muted={!micOn} />
            </button>

            <button
              onClick={onCameraToggle}
              disabled={isRecording}
              className={`${
                cameraOn
                  ? toolbarIconButtonClass
                  : `flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/18 bg-[linear-gradient(180deg,rgba(255,103,103,0.82),rgba(239,68,68,0.68))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_18px_34px_rgba(239,68,68,0.22)] backdrop-blur-2xl transition-all duration-200 hover:opacity-92`
              } ${isRecording ? "cursor-not-allowed opacity-45 hover:bg-inherit" : ""}`}
              title={cameraOn ? "Camera off" : "Camera on"}
            >
              <AnimatedCameraIcon off={!cameraOn} />
            </button>
          </div>

          {timerDone && (
            <button
              onClick={() => {
                onReset();
                onGenerateTopic();
              }}
              className={`${toolbarIconButtonClass} hidden w-auto gap-1.5 px-4 text-xs font-medium md:flex`}
              title="New Session"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5V1L7 6l5 5V7a6 6 0 0 1 0 12 6 6 0 0 1-6-6H4a8 8 0 1 0 8-8Z" />
              </svg>
              New Session
            </button>
          )}
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
              hasGeneratedTopic={hasGeneratedTopic}
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
                    ? "cursor-pointer rounded-lg px-2 focus-visible:ring-2 focus-visible:ring-white/50"
                    : ""
                } ${isRunning && timeLeft <= 10 ? "animate-pulse" : ""}`}
              >
                {formatSecondsDisplay(timeLeft)}
              </div>
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
                  className="cursor-pointer rounded-full bg-linear-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                >
                  Start
                </button>
              )}

              {isRunning && (
                <div className="flex items-center gap-3">
                  <motion.button
                    onClick={onPause}
                    whileTap={{ scale: 0.85 }}
                    className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-300 ${
                      isPaused
                        ? "border border-blue-400/30 bg-linear-to-br from-blue-500 to-blue-600 shadow-[0_4px_20px_rgba(37,99,235,0.4)]"
                        : overlayGlass
                    }`}
                    title={isPaused ? "Resume" : "Pause"}
                  >
                    <AnimatedPausePlayIcon paused={isPaused} />
                  </motion.button>
                  <motion.button
                    onClick={onFinish}
                    whileTap={{ scale: 0.85 }}
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
                    title="Finish"
                  >
                    <AnimatedStopIcon />
                  </motion.button>
                  <motion.button
                    onClick={onReset}
                    whileTap={{ scale: 0.85 }}
                    className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-white ${overlayGlass}`}
                    title="Reset"
                  >
                    <AnimatedResetIcon />
                  </motion.button>
                </div>
              )}

              {timerDone && (
                <button
                  onClick={() => {
                    onReset();
                    onGenerateTopic();
                  }}
                  className="cursor-pointer rounded-full bg-linear-to-br from-blue-500 to-blue-600 px-8 py-3 text-[14px] font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)] transition-opacity hover:opacity-90"
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
            recordedUrl={recordedUrl}
            isPreparingDownload={isPreparingDownload}
            onDownload={onDownloadRecording}
            onNewSession={() => {
              onReset();
              onGenerateTopic();
            }}
          />
        )}
      </div>
    </main>
  );
}
