"use client";

import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import PracticeStage from "@/components/practice-stage";
import { HomeFaq } from "@/components/home-faq";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { Component as FooterTapedDesign } from "@/components/ui/footer-taped-design";
import { usePracticeSession } from "@/hooks/use-practice-session";
import type { Topic } from "@/data/topics";

interface HomeClientProps {
  initialTopic: Topic;
}

export default function HomeClient({ initialTopic }: HomeClientProps) {
  const session = usePracticeSession(initialTopic);

  const handleJumpToPractice = () => {
    const practiceElement = document.getElementById("practice");
    if (!practiceElement) return;

    const rect = practiceElement.getBoundingClientRect();
    const elementCenter = window.scrollY + rect.top + rect.height / 2;
    window.scrollTo({
      top: elementCenter - window.innerHeight / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex min-h-screen flex-col transition-colors duration-300">
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
        <div className="origin-right scale-[0.5]">
          <CinematicThemeSwitcher />
        </div>
      </header>

      <HomeHero onJumpToPractice={handleJumpToPractice} />

      {session.mediaError && (
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          <span className="shrink-0">⚠️</span>
          <p className="flex-1">{session.mediaError}</p>
          <button
            onClick={session.clearMediaError}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            Dismiss
          </button>
        </div>
      )}

      <ErrorBoundary
        fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
      >
        <PracticeStage
          topic={session.topic}
          spinning={session.spinning}
          reelBlurbs={session.reelBlurbs}
          category={session.category}
          difficulty={session.difficulty}
          timerSeconds={session.timerSeconds}
          timeLeft={session.timeLeft}
          customPromptText={session.customPromptText}
          promptDraft={session.promptDraft}
          promptEditorOpen={session.promptEditorOpen}
          timeEditorOpen={session.timeEditorOpen}
          timeDraft={session.timeDraft}
          isRunning={session.isRunning}
          isPaused={session.isPaused}
          timerDone={session.timerDone}
          cameraOn={session.cameraOn}
          micOn={session.micOn}
          isRecording={session.isRecording}
          recordedBlob={session.recordedBlob}
          recordedUrl={session.recordedUrl}
          isPreparingDownload={session.isPreparingDownload}
          videoFormat={session.videoFormat}
          isCompactDevice={session.isCompactDevice}
          settingsOpen={session.settingsOpen}
          inSession={session.inSession}
          canEditPrompt={session.canEditPrompt}
          canEditTime={session.canEditTime}
          videoRef={session.videoRef}
          timeInputRef={session.timeInputRef}
          onCategoryChange={session.handleCategoryChange}
          onDifficultyChange={session.handleDifficultyChange}
          onPromptEditStart={session.openPromptEditor}
          onPromptDraftChange={session.setPromptDraft}
          onPromptSave={session.savePromptDraft}
          onPromptCancel={session.cancelPromptDraft}
          onTimeEditStart={session.openTimeEditor}
          onTimeDraftChange={session.setTimeDraft}
          onTimeSave={session.saveTimeDraft}
          onTimeCancel={session.cancelTimeDraft}
          onTimeDoubleClick={session.handleTimerDoubleClick}
          onTimeTouchEnd={session.handleTimerTouchEnd}
          onGenerateTopic={session.generateTopic}
          onKnobChange={session.handleKnobChange}
          onStart={session.startTimer}
          onPause={session.pauseTimer}
          onFinish={session.finishTimer}
          onReset={session.resetTimer}
          onMicToggle={session.toggleMic}
          onCameraToggle={session.toggleCamera}
          onDownloadRecording={session.downloadRecording}
          onOpenSettings={session.openSettings}
          onCloseSettings={session.closeSettings}
          onFormatChange={session.setVideoFormat}
        />
      </ErrorBoundary>

      <HomeFaq />
      <FooterTapedDesign />
    </div>
  );
}
