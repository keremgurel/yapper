"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { Topic } from "@/data/topics";
import type { Category, Difficulty } from "@/data/topics";
import { playStartRecording, playStopRecording } from "@/lib/audio";
import {
  trackSessionStarted,
  trackSessionCompleted,
  trackSessionReset,
  trackSessionPaused,
  trackMediaToggle,
} from "@/lib/analytics";
import { useCompactDevice } from "@/hooks/use-compact-device";
import { useTopicGenerator } from "@/hooks/use-topic-generator";
import { usePromptEditor } from "@/hooks/use-prompt-editor";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { useTimerEditor } from "@/hooks/use-timer-editor";
import { useMediaStream } from "@/hooks/use-media-stream";

export type PracticeMode = "topic" | "freestyle";

interface PracticeSessionContextValue {
  // Mode
  mode: PracticeMode;

  // Topic
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
  category: Category | "All";
  difficulty: Difficulty | "All";
  hasGeneratedTopic: boolean;
  customPromptText: string | null;
  generateTopic: () => void;
  handleCategoryChange: (value: string) => void;
  handleDifficultyChange: (value: string) => void;

  // Prompt editor
  promptEditorOpen: boolean;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  openPromptEditor: () => void;
  savePromptDraft: () => void;
  cancelPromptDraft: () => void;

  // Timer
  timerSeconds: number;
  timeLeft: number;
  isRunning: boolean;
  isPaused: boolean;
  timerDone: boolean;
  inSession: boolean;

  // Timer editor
  timeEditorOpen: boolean;
  timeDraft: string;
  timeInputRef: React.RefObject<HTMLInputElement | null>;
  setTimeDraft: (value: string) => void;
  openTimeEditor: () => void;
  saveTimeDraft: () => void;
  cancelTimeDraft: () => void;
  handleKnobChange: (value: number) => void;
  handleTimerDoubleClick: (event: React.MouseEvent) => void;
  handleTimerTouchEnd: (event: React.TouchEvent) => void;

  // Media
  cameraOn: boolean;
  micOn: boolean;
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  isPreparingDownload: boolean;
  mediaError: string | null;
  clearMediaError: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  downloadRecording: () => void;

  // Orchestrated actions
  startTimer: () => void;
  pauseTimer: () => void;
  finishTimer: () => void;
  resetTimer: () => void;

  // Derived
  canEditPrompt: boolean;
  canEditTime: boolean;
  isCompactDevice: boolean;
}

const PracticeSessionContext =
  createContext<PracticeSessionContextValue | null>(null);

export function PracticeSessionProvider({
  initialTopic,
  mode = "topic",
  children,
}: {
  initialTopic: Topic;
  mode?: PracticeMode;
  children: React.ReactNode;
}) {
  const isCompactDevice = useCompactDevice();
  const topicGen = useTopicGenerator(initialTopic);
  const media = useMediaStream();
  const sessionStartTimeRef = useRef<number>(0);

  const timer = useSessionTimer({
    onTimerExpired: () => {
      media.stopRecording();
    },
  });

  const promptEditor = usePromptEditor({
    customPromptText: topicGen.customPromptText,
    topicText: topicGen.topic.text,
    onSave: (trimmed) => {
      topicGen.setCustomPromptText(trimmed);
      if (trimmed !== null) topicGen.setHasGeneratedTopic(true);
    },
  });

  const timerEditor = useTimerEditor({
    timerSeconds: timer.timerSeconds,
    isRunning: timer.isRunning,
    onTimerSecondsChange: timer.setTimerSeconds,
    onTimeLeftChange: timer.setTimeLeft,
  });

  // --- Cross-cutting orchestration ---

  const startTimer = useCallback(() => {
    promptEditor.closeEditor();
    timerEditor.closeEditor();
    media.clearRecordedMedia();
    timer.start();
    playStartRecording();
    media.startRecording();
    sessionStartTimeRef.current = Date.now();
    trackSessionStarted({
      mode,
      timerSeconds: timer.timerSeconds,
      cameraOn: media.cameraOn,
      micOn: media.micOn,
      category: topicGen.category,
      difficulty: topicGen.difficulty,
      topicText:
        mode === "topic"
          ? (topicGen.customPromptText ?? topicGen.topic.text)
          : undefined,
    });
  }, [promptEditor, timerEditor, media, timer, mode, topicGen]);

  const finishTimer = useCallback(() => {
    const elapsed = Math.round(
      (Date.now() - sessionStartTimeRef.current) / 1000,
    );
    timer.finish();
    media.stopRecording();
    playStopRecording();
    trackSessionCompleted({
      mode,
      timerSeconds: timer.timerSeconds,
      elapsedSeconds: elapsed,
      finishedEarly: elapsed < timer.timerSeconds,
      cameraOn: media.cameraOn,
      micOn: media.micOn,
      hadRecording: media.cameraOn || media.micOn,
    });
  }, [timer, media, mode]);

  const resetTimer = useCallback(() => {
    if (timer.isRunning || timer.isPaused) {
      const elapsed = Math.round(
        (Date.now() - sessionStartTimeRef.current) / 1000,
      );
      trackSessionReset({
        mode,
        elapsedSeconds: elapsed,
        timerSeconds: timer.timerSeconds,
      });
    }
    timer.reset();
    media.stopRecording();
    media.clearRecordedMedia();
    media.reattachStream(media.cameraOn);
  }, [timer, media, mode]);

  const pauseTimer = useCallback(() => {
    timer.pause();
    trackSessionPaused({ action: timer.isPaused ? "resume" : "pause" });
  }, [timer]);

  const wrappedToggleCamera = useCallback(async () => {
    await media.toggleCamera();
    // After toggle, the new state is the opposite of current
    trackMediaToggle({ media: "camera", enabled: !media.cameraOn });
  }, [media]);

  const wrappedToggleMic = useCallback(async () => {
    await media.toggleMic();
    trackMediaToggle({ media: "mic", enabled: !media.micOn });
  }, [media]);

  const canEditPrompt = !timer.inSession && !topicGen.spinning;
  const canEditTime = !timer.isRunning;

  const value = useMemo<PracticeSessionContextValue>(
    () => ({
      mode,
      topic: topicGen.topic,
      spinning: topicGen.spinning,
      reelBlurbs: topicGen.reelBlurbs,
      category: topicGen.category,
      difficulty: topicGen.difficulty,
      hasGeneratedTopic: topicGen.hasGeneratedTopic,
      customPromptText: topicGen.customPromptText,
      generateTopic: topicGen.generateTopic,
      handleCategoryChange: topicGen.handleCategoryChange,
      handleDifficultyChange: topicGen.handleDifficultyChange,

      promptEditorOpen: promptEditor.promptEditorOpen,
      promptDraft: promptEditor.promptDraft,
      setPromptDraft: promptEditor.setPromptDraft,
      openPromptEditor: promptEditor.openPromptEditor,
      savePromptDraft: promptEditor.savePromptDraft,
      cancelPromptDraft: promptEditor.cancelPromptDraft,

      timerSeconds: timer.timerSeconds,
      timeLeft: timer.timeLeft,
      isRunning: timer.isRunning,
      isPaused: timer.isPaused,
      timerDone: timer.timerDone,
      inSession: timer.inSession,

      timeEditorOpen: timerEditor.timeEditorOpen,
      timeDraft: timerEditor.timeDraft,
      timeInputRef: timerEditor.timeInputRef,
      setTimeDraft: timerEditor.setTimeDraft,
      openTimeEditor: timerEditor.openTimeEditor,
      saveTimeDraft: timerEditor.saveTimeDraft,
      cancelTimeDraft: timerEditor.cancelTimeDraft,
      handleKnobChange: timerEditor.handleKnobChange,
      handleTimerDoubleClick: timerEditor.handleTimerDoubleClick,
      handleTimerTouchEnd: timerEditor.handleTimerTouchEnd,

      cameraOn: media.cameraOn,
      micOn: media.micOn,
      isRecording: media.isRecording,
      recordedBlob: media.recordedBlob,
      recordedUrl: media.recordedUrl,
      isPreparingDownload: media.isPreparingDownload,
      mediaError: media.mediaError,
      clearMediaError: media.clearMediaError,
      videoRef: media.videoRef,
      toggleCamera: wrappedToggleCamera,
      toggleMic: wrappedToggleMic,
      downloadRecording: media.downloadRecording,

      startTimer,
      pauseTimer,
      finishTimer,
      resetTimer,

      canEditPrompt,
      canEditTime,
      isCompactDevice,
    }),
    [
      mode,
      topicGen,
      promptEditor,
      timer,
      timerEditor,
      media,
      startTimer,
      pauseTimer,
      finishTimer,
      resetTimer,
      wrappedToggleCamera,
      wrappedToggleMic,
      canEditPrompt,
      canEditTime,
      isCompactDevice,
    ],
  );

  return (
    <PracticeSessionContext value={value}>{children}</PracticeSessionContext>
  );
}

export function usePracticeSession(): PracticeSessionContextValue {
  const context = useContext(PracticeSessionContext);
  if (!context) {
    throw new Error(
      "usePracticeSession must be used within a PracticeSessionProvider",
    );
  }
  return context;
}
