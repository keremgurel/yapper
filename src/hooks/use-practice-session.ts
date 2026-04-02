"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Category, type Difficulty, type Topic } from "@/data/topics";
import { playSlotTick, playTimerEnd } from "@/lib/audio";
import {
  clampTimerSeconds,
  getRandomTopic,
  pickReelBlurbs,
} from "@/lib/practice-helpers";
import { exportRecordingWithOverlays } from "@/lib/video-export";

const RECORDING_VIDEO_BITS_PER_SECOND = 12_000_000;
const RECORDING_AUDIO_BITS_PER_SECOND = 192_000;

async function resetTrackZoom(track: MediaStreamTrack | undefined) {
  if (!track || track.kind !== "video") return;

  const configurableTrack = track as MediaStreamTrack & {
    getCapabilities?: () => MediaTrackCapabilities & {
      zoom?: { min?: number };
    };
    applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
  };
  const capabilities = configurableTrack.getCapabilities?.();
  const minZoom =
    typeof capabilities?.zoom === "object" && capabilities.zoom
      ? capabilities.zoom.min
      : undefined;

  if (typeof minZoom !== "number") return;

  try {
    await configurableTrack.applyConstraints({
      advanced: [{ zoom: minZoom }],
    });
  } catch {
    // Ignore zoom reset failures. Browsers vary on support here.
  }
}

function getPreferredVideoConstraints(format: "portrait" | "landscape") {
  return format === "landscape"
    ? {
        facingMode: "user",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      }
    : {
        facingMode: "user",
        width: { ideal: 1080 },
        height: { ideal: 1920 },
        frameRate: { ideal: 30, max: 60 },
      };
}

export function usePracticeSession(initialTopic: Topic) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
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
  const [videoFormat, setVideoFormat] = useState<"portrait" | "landscape">(
    "landscape",
  );
  const [exportProgress, setExportProgress] = useState(0);
  const [isCompactDevice, setIsCompactDevice] = useState(false);
  const [hasCustomizedFormat, setHasCustomizedFormat] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const lastTimerTapRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const appliedVideoFormatRef = useRef<"portrait" | "landscape" | null>(null);

  const inSession = isRunning || isPaused;
  const canEditPrompt = !inSession && !spinning;
  const canEditTime = !isRunning;
  const effectiveVideoFormat = videoFormat;

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");

    const updateDeviceMode = () => {
      setIsCompactDevice(query.matches || window.innerWidth < 1024);
    };

    updateDeviceMode();
    query.addEventListener("change", updateDeviceMode);
    window.addEventListener("resize", updateDeviceMode);

    return () => {
      query.removeEventListener("change", updateDeviceMode);
      window.removeEventListener("resize", updateDeviceMode);
    };
  }, []);

  useEffect(() => {
    if (hasCustomizedFormat) return;
    setVideoFormat(isCompactDevice ? "portrait" : "landscape");
  }, [hasCustomizedFormat, isCompactDevice]);

  const generateTopic = useCallback(() => {
    setCustomPromptText(null);
    setSettingsOpen(false);
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
      setSettingsOpen(false);
      setTopic(getRandomTopic(topic, nextCategory, difficulty));
    },
    [difficulty, topic],
  );

  const handleDifficultyChange = useCallback(
    (value: string) => {
      const nextDifficulty = value as Difficulty | "All";
      setDifficulty(nextDifficulty);
      setCustomPromptText(null);
      setSettingsOpen(false);
      setTopic(getRandomTopic(topic, category, nextDifficulty));
    },
    [category, topic],
  );

  const openPromptEditor = useCallback(() => {
    setSettingsOpen(false);
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
    setSettingsOpen(false);
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
    setSettingsOpen(false);
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
      videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
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
    setSettingsOpen(false);
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

  const replaceVideoTrack = useCallback(
    async (format: "portrait" | "landscape") => {
      const nextVideoStream = await navigator.mediaDevices.getUserMedia({
        video: getPreferredVideoConstraints(format),
      });
      const nextVideoTrack = nextVideoStream.getVideoTracks()[0];
      await resetTrackZoom(nextVideoTrack);

      const currentStream = streamRef.current ?? new MediaStream();
      currentStream.getVideoTracks().forEach((track) => {
        currentStream.removeTrack(track);
        track.stop();
      });
      currentStream.addTrack(nextVideoTrack);
      streamRef.current = currentStream;
      appliedVideoFormatRef.current = format;
      requestAnimationFrame(() => attachStream());
    },
    [attachStream],
  );

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      streamRef.current?.getVideoTracks().forEach((track) => track.stop());
      streamRef.current
        ?.getVideoTracks()
        .forEach((track) => streamRef.current!.removeTrack(track));
      appliedVideoFormatRef.current = null;
      setCameraOn(false);

      if (!micOn) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    try {
      await replaceVideoTrack(effectiveVideoFormat);
      setCameraOn(true);
    } catch {
      alert("Camera access is required.");
    }
  }, [cameraOn, effectiveVideoFormat, micOn, replaceVideoTrack]);

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
          video: cameraOn
            ? getPreferredVideoConstraints(effectiveVideoFormat)
            : false,
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
  }, [cameraOn, effectiveVideoFormat, micOn]);

  useEffect(() => {
    if (cameraOn) {
      requestAnimationFrame(() => attachStream());
    }
  }, [attachStream, cameraOn]);

  useEffect(() => {
    if (
      !cameraOn ||
      isRunning ||
      appliedVideoFormatRef.current === effectiveVideoFormat
    ) {
      return;
    }

    replaceVideoTrack(effectiveVideoFormat).catch(() => {
      alert("Camera settings could not be updated.");
    });
  }, [cameraOn, effectiveVideoFormat, isRunning, replaceVideoTrack]);

  const downloadRecording = useCallback(async () => {
    if (!recordedBlob || isExportingVideo) return;

    setIsExportingVideo(true);
    setExportProgress(0);

    try {
      const exportedBlob =
        !cameraOn && micOn
          ? recordedBlob
          : await exportRecordingWithOverlays({
              blob: recordedBlob,
              prompt: customPromptText ?? topic.text,
              timerSeconds,
              showPromptOverlay: includePromptOverlay,
              showTimerOverlay: includeTimerOverlay,
              format: effectiveVideoFormat,
              onProgress: (progress) => setExportProgress(progress),
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
    cameraOn,
    micOn,
    recordedBlob,
    timerSeconds,
    topic.text,
    effectiveVideoFormat,
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
    videoFormat: effectiveVideoFormat,
    exportProgress,
    isCompactDevice,
    settingsOpen,
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
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    toggleSettings: () => setSettingsOpen((current) => !current),
    setVideoFormat: (format: "portrait" | "landscape") => {
      setHasCustomizedFormat(true);
      setVideoFormat(format);
    },
  };
}
