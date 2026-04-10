"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Topic } from "@/data/topics";
import type { Category, Difficulty } from "@/data/topics";
import { playStartRecording, playStopRecording } from "@/lib/audio";
import { useCompactDevice } from "@/hooks/use-compact-device";
import { useTopicGenerator } from "@/hooks/use-topic-generator";
import { usePromptEditor } from "@/hooks/use-prompt-editor";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { useTimerEditor } from "@/hooks/use-timer-editor";
import { useMediaStream } from "@/hooks/use-media-stream";

interface PracticeSessionContextValue {
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
  children,
}: {
  initialTopic: Topic;
  children: React.ReactNode;
}) {
  const isCompactDevice = useCompactDevice();
  const topicGen = useTopicGenerator(initialTopic);
  const media = useMediaStream();

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
  }, [promptEditor, timerEditor, media, timer]);

  const finishTimer = useCallback(() => {
    timer.finish();
    media.stopRecording();
    playStopRecording();
  }, [timer, media]);

  const resetTimer = useCallback(() => {
    timer.reset();
    media.stopRecording();
    media.clearRecordedMedia();
    media.reattachStream(media.cameraOn);
  }, [timer, media]);

  const canEditPrompt = !timer.inSession && !topicGen.spinning;
  const canEditTime = !timer.isRunning;

  const value = useMemo<PracticeSessionContextValue>(
    () => ({
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
      toggleCamera: media.toggleCamera,
      toggleMic: media.toggleMic,
      downloadRecording: media.downloadRecording,

      startTimer,
      pauseTimer: timer.pause,
      finishTimer,
      resetTimer,

      canEditPrompt,
      canEditTime,
      isCompactDevice,
    }),
    [
      topicGen,
      promptEditor,
      timer,
      timerEditor,
      media,
      startTimer,
      finishTimer,
      resetTimer,
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
