"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  Grid3x3,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Type,
} from "lucide-react";
import { useMediaStream } from "@/hooks/use-media-stream";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { useAudioLevel } from "@/hooks/use-audio-level";
import {
  useTeleprompterScroll,
  WPM_PRESETS,
} from "@/hooks/use-teleprompter-scroll";
import { useTeleprompterSettings } from "@/hooks/use-teleprompter-settings";
import {
  formatElapsed,
  useCountdown,
  useElapsedSeconds,
} from "@/hooks/use-record-timer";
import TeleprompterOverlay from "@/components/teleprompter/teleprompter-overlay";
import TeleprompterSettingsPanel from "@/components/teleprompter/teleprompter-settings";
import RecorderDevices from "@/components/teleprompter/recorder-devices";
import RecorderGuides from "@/components/teleprompter/recorder-guides";
import AudioMeter from "@/components/teleprompter/audio-meter";
import RecorderReview from "@/components/teleprompter/recorder-review";

const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-40";

/**
 * TikTok-style teleprompter recorder: live camera with the chosen prompt
 * scrolling over the top. Composes the media stream and the scroll engine —
 * starting a recording runs a 3-2-1 countdown, then records and scrolls;
 * stopping drops into review. An immersive mode fills the screen so nothing
 * else is on-camera. Camera + mic are enabled once on mount.
 */
export default function TeleprompterRecorder({
  text,
  itemId = null,
  itemTitle,
  onExit,
}: {
  text: string;
  /** Content Library item this take is for (enables Save to library). */
  itemId?: string | null;
  itemTitle?: string;
  onExit?: () => void;
}) {
  const {
    cameraOn,
    micOn,
    isRecording,
    isPaused,
    recordedBlob,
    recordedUrl,
    mediaError,
    videoRef,
    toggleCamera,
    toggleMic,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecordedMedia,
    reattachStream,
    videoDeviceId,
    audioDeviceId,
    selectVideoDevice,
    selectAudioDevice,
    getStream,
  } = useMediaStream();
  const { cameras, mics } = useMediaDevices(cameraOn || micOn);
  const audioLevel = useAudioLevel(getStream, micOn, audioDeviceId);
  const { settings: tp, update: updateTp } = useTeleprompterSettings();
  const scroll = useTeleprompterScroll(tp.fontScale);
  const { play: scrollPlay, pause: scrollPause, reset: scrollReset } = scroll;
  const {
    count,
    start: startCountdown,
    cancel: cancelCountdown,
  } = useCountdown();
  // One recording session spans its pauses/resumes; a fresh take bumps it so the
  // timer and the teleprompter lead-in reset. Paused time is excluded.
  const [session, setSession] = useState(0);
  const elapsed = useElapsedSeconds(isRecording && !isPaused, session);
  const [immersive, setImmersive] = useState(false);
  const [tpOpen, setTpOpen] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const hasText = text.trim().length > 0;
  // With no camera and no mic there's nothing to capture — startRecording would
  // silently no-op, so gate on it (else the prompt scrolls while nothing records).
  const canRecord = cameraOn || micOn;

  // Enable camera + mic once, sequentially (the stream is shared, so overlapping
  // getUserMedia calls can race).
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    void (async () => {
      await toggleCamera();
      await toggleMic();
    })();
  }, [toggleCamera, toggleMic]);

  // Drive the teleprompter off the *actual* recording state, so the scroll can
  // never run without a live recording — and it stops if the recorder errors
  // out (not just on an explicit Stop press).
  // Scroll only while actively recording (not paused). Hold for the lead-in at
  // the very start of a take, then continue immediately across resumes.
  const leadInDoneRef = useRef(false);
  useEffect(() => {
    if (isRecording && !isPaused && hasText) {
      if (leadInDoneRef.current) {
        scrollPlay();
        return;
      }
      const id = setTimeout(() => {
        leadInDoneRef.current = true;
        scrollPlay();
      }, tp.leadInSec * 1000);
      return () => clearTimeout(id);
    }
    scrollPause();
  }, [isRecording, isPaused, hasText, scrollPlay, scrollPause, tp.leadInSec]);

  const beginRecording = () => {
    leadInDoneRef.current = false;
    setSession((s) => s + 1);
    scrollReset();
    startRecording();
  };

  // Center button: start a take (with a 3-2-1 pre-roll), then pause and resume
  // it with the same button. The check on the right finishes the take.
  const onRecordButton = () => {
    if (count !== null) {
      cancelCountdown();
      return;
    }
    if (!isRecording) {
      if (!canRecord) return;
      startCountdown(3, beginRecording);
      return;
    }
    if (isPaused) resumeRecording();
    else pauseRecording();
  };

  const finishRecording = () => {
    if (isRecording) stopRecording();
  };

  // Desktop shortcuts: Space starts/pauses/resumes, Enter finishes, F fullscreen,
  // G guides. The handlers close over live state, so read them through refs kept
  // fresh each render rather than re-binding the listener every render.
  const onRecordButtonRef = useRef(onRecordButton);
  const finishRef = useRef(finishRecording);
  useEffect(() => {
    onRecordButtonRef.current = onRecordButton;
    finishRef.current = finishRecording;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        onRecordButtonRef.current();
      } else if (e.key === "Enter") {
        finishRef.current();
      } else if (e.key === "f" || e.key === "F") {
        setImmersive((v) => !v);
      } else if (e.key === "g" || e.key === "G") {
        setShowGuides((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const retake = () => {
    clearRecordedMedia();
    scroll.reset();
    void reattachStream(cameraOn);
  };

  if (recordedUrl && recordedBlob) {
    return (
      <RecorderReview
        url={recordedUrl}
        blob={recordedBlob}
        itemId={itemId}
        title={itemTitle}
        onRetake={retake}
      />
    );
  }

  return (
    <div
      className={
        immersive
          ? "fixed inset-0 z-50 flex items-center justify-center bg-black"
          : "mx-auto flex w-full max-w-md flex-col items-center px-4 py-6"
      }
    >
      <div
        className={
          immersive
            ? "relative aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden bg-black"
            : "relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black"
        }
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />

        {showGuides && <RecorderGuides />}

        {hasText && (
          <TeleprompterOverlay
            scrollRef={scroll.scrollRef}
            text={text}
            fontScale={tp.fontScale}
            heightPct={tp.heightPct}
            opacity={tp.opacity}
          />
        )}

        {/* Recording indicator with elapsed time (pauses with the recording). */}
        {isRecording && (
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 backdrop-blur-md">
            {isPaused ? (
              <Pause className="h-3 w-3 text-white" />
            ) : (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            )}
            <span className="font-mono text-xs font-bold text-white">
              {formatElapsed(elapsed)}
            </span>
            {isPaused && (
              <span className="text-[10px] font-bold text-white/70">
                Paused
              </span>
            )}
          </div>
        )}

        {/* Top-right controls: fullscreen + framing guides. */}
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setImmersive((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
            title={immersive ? "Exit fullscreen" : "Fullscreen"}
            aria-label={immersive ? "Exit fullscreen" : "Fullscreen"}
          >
            {immersive ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowGuides((v) => !v)}
            aria-pressed={showGuides}
            className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              showGuides
                ? "bg-white text-black"
                : "bg-black/50 text-white hover:bg-black/70"
            }`}
            title="Framing guides"
            aria-label="Framing guides"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
        </div>

        {/* Camera / mic picker + flip (hidden while recording). */}
        {!isRecording && (cameras.length > 0 || mics.length > 0) && (
          <div className="absolute top-4 left-4 z-50">
            <RecorderDevices
              cameras={cameras}
              mics={mics}
              videoDeviceId={videoDeviceId}
              audioDeviceId={audioDeviceId}
              onSelectCamera={selectVideoDevice}
              onSelectMic={selectAudioDevice}
              disabled={count !== null}
            />
          </div>
        )}

        {/* 3-2-1 pre-roll. */}
        {count !== null && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <span className="font-mono text-8xl font-black text-white drop-shadow-lg">
              {count}
            </span>
          </div>
        )}

        {mediaError && (
          <div className="absolute inset-x-4 top-16 z-40 rounded-lg bg-red-950/80 px-3 py-2 text-xs font-bold text-red-200 backdrop-blur-md">
            {mediaError}
          </div>
        )}

        {/* Bottom control bar */}
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-5">
          {hasText && !isRecording && count === null && (
            <div className="flex w-full flex-col items-center gap-2">
              {tpOpen && (
                <TeleprompterSettingsPanel settings={tp} onChange={updateTp} />
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-white/70">
                  Speed
                </span>
                {WPM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => scroll.setWpm(preset)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      scroll.wpm === preset
                        ? "bg-white text-black"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTpOpen((v) => !v)}
                  aria-pressed={tpOpen}
                  className={`ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    tpOpen
                      ? "bg-white text-black"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                  title="Teleprompter settings"
                  aria-label="Teleprompter settings"
                >
                  <Type className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {micOn && <AudioMeter level={audioLevel} />}

          <div className="flex items-center gap-6">
            {/* Left: mic toggle when idle, spacer while recording (keeps the
                record button centered). */}
            {isRecording ? (
              <div className="h-11 w-11" />
            ) : (
              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={count !== null}
                className={iconBtn}
                title={micOn ? "Mute" : "Unmute"}
              >
                {micOn ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Center: record, then pause / resume with the same button. */}
            <button
              type="button"
              onClick={onRecordButton}
              disabled={!isRecording && count === null && !canRecord}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-transparent disabled:opacity-40"
              title={
                !canRecord && !isRecording
                  ? "Turn on your camera or mic first"
                  : count !== null
                    ? "Cancel"
                    : isRecording
                      ? isPaused
                        ? "Resume"
                        : "Pause"
                      : "Record"
              }
            >
              <span
                className={
                  (isRecording && !isPaused) || count !== null
                    ? "h-6 w-6 rounded-md bg-red-500"
                    : "h-12 w-12 rounded-full bg-red-500"
                }
              />
            </button>

            {/* Right: camera toggle when idle, Done check while recording. */}
            {isRecording ? (
              <button
                type="button"
                onClick={finishRecording}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-opacity hover:opacity-90"
                title="Done"
                aria-label="Finish recording"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void toggleCamera()}
                disabled={count !== null}
                className={iconBtn}
                title={cameraOn ? "Camera off" : "Camera on"}
              >
                {cameraOn ? (
                  <Camera className="h-4 w-4" />
                ) : (
                  <CameraOff className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {!isRecording && !immersive && onExit && (
        <button
          type="button"
          onClick={onExit}
          className="text-foreground/50 hover:text-foreground mt-4 text-xs font-bold"
        >
          Back to teleprompter options
        </button>
      )}
    </div>
  );
}
