"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import topics, {
  type Category,
  type Difficulty,
  type Topic,
} from "@/data/topics";
import { playSlotTick, playTimerEnd } from "@/lib/audio";
import {
  clampTimerSeconds,
  getRandomTopic,
  pickReelBlurbs,
} from "@/lib/practice-helpers";
import { exportRecordingWithOverlays } from "@/lib/video-export";

export function usePracticeSession() {
  const [topic, setTopic] = useState<Topic>(topics[0]);
  const [spinning, setSpinning] = useState(false);
  const [reelBlurbs, setReelBlurbs] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [customPromptText, setCustomPromptText] = useState<string | null>(null);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [includePromptOverlay, setIncludePromptOverlay] = useState(true);
  const [includeTimerOverlay, setIncludeTimerOverlay] = useState(true);
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  const didInit = useRef(false);
  const lastTimerTapRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const inSession = isRunning || isPaused;
  const canEditPrompt = !inSession && !spinning;
  const canEditTime = !isRunning;

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      setTopic(getRandomTopic(null, "All", "All"));
    }
  }, []);

  const generateTopic = useCallback(() => {
    setCustomPromptText(null);
    setReelBlurbs(pickReelBlurbs());
    setSpinning(true);
    const tickInterval = setInterval(
      () => playSlotTick(600 + Math.random() * 400),
      80,
    );
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setReelBlurbs([]);
      setTopic((prev) => getRandomTopic(prev, category, difficulty));
    }, 600);
  }, [category, difficulty]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      const nextCategory = value as Category | "All";
      setCategory(nextCategory);
      setCustomPromptText(null);
      setTopic(getRandomTopic(topic, nextCategory, difficulty));
    },
    [difficulty, topic],
  );

  const handleDifficultyChange = useCallback(
    (value: string) => {
      const nextDifficulty = value as Difficulty | "All";
      setDifficulty(nextDifficulty);
      setCustomPromptText(null);
      setTopic(getRandomTopic(topic, category, nextDifficulty));
    },
    [category, topic],
  );

  const openPromptEditor = useCallback(() => {
    setPromptDraft(customPromptText ?? topic.text);
    setPromptEditorOpen(true);
  }, [customPromptText, topic.text]);

  const savePromptDraft = useCallback(() => {
    const trimmed = promptDraft.trim();
    setCustomPromptText(trimmed.length > 0 ? trimmed : null);
    setPromptEditorOpen(false);
  }, [promptDraft]);

  const cancelPromptDraft = useCallback(() => {
    setPromptDraft(customPromptText ?? topic.text);
    setPromptEditorOpen(false);
  }, [customPromptText, topic.text]);

  const openTimeEditor = useCallback(() => {
    setTimeDraft(String(timerSeconds));
    setTimeEditorOpen(true);
  }, [timerSeconds]);

  const saveTimeDraft = useCallback(() => {
    const parsed = parseInt(timeDraft, 10);
    if (Number.isNaN(parsed)) {
      setTimeDraft(String(timerSeconds));
      setTimeEditorOpen(false);
      return;
    }

    const nextSeconds = clampTimerSeconds(parsed);
    setTimerSeconds(nextSeconds);
    if (!isRunning) setTimeLeft(nextSeconds);
    setTimeEditorOpen(false);
  }, [isRunning, timeDraft, timerSeconds]);

  const cancelTimeDraft = useCallback(() => {
    setTimeDraft(String(timerSeconds));
    setTimeEditorOpen(false);
  }, [timerSeconds]);

  useEffect(() => {
    if (!timeEditorOpen) return;
    requestAnimationFrame(() => {
      timeInputRef.current?.focus();
      timeInputRef.current?.select();
    });
  }, [timeEditorOpen]);

  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((current) => {
          if (current <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setTimerDone(true);
            playTimerEnd();
            if (recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
              setIsRecording(false);
            }
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, isRunning, timeLeft]);

  const startTimer = useCallback(() => {
    setTimeLeft(timerSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerDone(false);
    setPromptEditorOpen(false);
    setTimeEditorOpen(false);
    setRecordedBlob(null);
    setIsPreparingDownload(false);
    setIsExportingVideo(false);

    if (!streamRef.current) return;

    chunksRef.current = [];
    setIsPreparingDownload(true);

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });

    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const nextBlob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(nextBlob);
      setIsPreparingDownload(false);
    };
    recorder.start();
    setIsRecording(true);
  }, [timerSeconds]);

  const pauseTimer = useCallback(() => {
    setIsPaused((current) => !current);
  }, []);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(false);
    setTimeLeft(timerSeconds);
    setIsPreparingDownload(false);
    setIsExportingVideo(false);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  }, [timerSeconds]);

  const handleKnobChange = useCallback(
    (value: number) => {
      const nextSeconds = clampTimerSeconds(value);
      setTimerSeconds(nextSeconds);
      if (!isRunning) setTimeLeft(nextSeconds);
    },
    [isRunning],
  );

  const handleTimerDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (isRunning) return;
      event.preventDefault();
      openTimeEditor();
    },
    [isRunning, openTimeEditor],
  );

  const handleTimerTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (isRunning) return;
      const now = Date.now();
      if (now - lastTimerTapRef.current < 320) {
        event.preventDefault();
        openTimeEditor();
        lastTimerTapRef.current = 0;
      } else {
        lastTimerTapRef.current = now;
      }
    },
    [isRunning, openTimeEditor],
  );

  const attachStream = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      streamRef.current?.getVideoTracks().forEach((track) => track.stop());
      streamRef.current
        ?.getVideoTracks()
        .forEach((track) => streamRef.current!.removeTrack(track));
      setCameraOn(false);

      if (!micOn) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    try {
      if (streamRef.current) {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        streamRef.current.addTrack(videoTrack);
      } else {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: micOn,
        });
        streamRef.current = nextStream;
        if (!micOn) {
          nextStream.getAudioTracks().forEach((track) => track.stop());
          nextStream
            .getAudioTracks()
            .forEach((track) => nextStream.removeTrack(track));
        }
      }
      setCameraOn(true);
      requestAnimationFrame(() => attachStream());
    } catch {
      alert("Camera access is required.");
    }
  }, [attachStream, cameraOn, micOn]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      streamRef.current?.getAudioTracks().forEach((track) => track.stop());
      streamRef.current
        ?.getAudioTracks()
        .forEach((track) => streamRef.current!.removeTrack(track));
      setMicOn(false);

      if (!cameraOn) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    try {
      if (streamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioTrack = audioStream.getAudioTracks()[0];
        streamRef.current.addTrack(audioTrack);
      } else {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: cameraOn ? { facingMode: "user" } : false,
        });
        streamRef.current = nextStream;
        if (!cameraOn) {
          nextStream.getVideoTracks().forEach((track) => track.stop());
          nextStream
            .getVideoTracks()
            .forEach((track) => nextStream.removeTrack(track));
        }
      }
      setMicOn(true);
    } catch {
      alert("Microphone access is required.");
    }
  }, [cameraOn, micOn]);

  useEffect(() => {
    if (cameraOn) {
      requestAnimationFrame(() => attachStream());
    }
  }, [attachStream, cameraOn]);

  const downloadRecording = useCallback(async () => {
    if (!recordedBlob || isExportingVideo) return;

    setIsExportingVideo(true);

    try {
      const exportedBlob = await exportRecordingWithOverlays({
        blob: recordedBlob,
        prompt: customPromptText ?? topic.text,
        timerSeconds,
        showPromptOverlay: includePromptOverlay,
        showTimerOverlay: includeTimerOverlay,
      });

      const downloadUrl = URL.createObjectURL(exportedBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `yapper-${new Date().toISOString().slice(0, 19)}.webm`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } finally {
      setIsExportingVideo(false);
    }
  }, [
    customPromptText,
    includePromptOverlay,
    includeTimerOverlay,
    isExportingVideo,
    recordedBlob,
    timerSeconds,
    topic.text,
  ]);

  return {
    topic,
    spinning,
    reelBlurbs,
    category,
    difficulty,
    timerSeconds,
    timeLeft,
    customPromptText,
    promptEditorOpen,
    promptDraft,
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
    setPromptDraft,
    setTimeDraft,
    setIncludePromptOverlay,
    setIncludeTimerOverlay,
    generateTopic,
    handleCategoryChange,
    handleDifficultyChange,
    openPromptEditor,
    savePromptDraft,
    cancelPromptDraft,
    openTimeEditor,
    saveTimeDraft,
    cancelTimeDraft,
    startTimer,
    pauseTimer,
    resetTimer,
    handleKnobChange,
    handleTimerDoubleClick,
    handleTimerTouchEnd,
    toggleCamera,
    toggleMic,
    downloadRecording,
  };
}
