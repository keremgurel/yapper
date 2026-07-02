"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useMediaStream } from "@/hooks/use-media-stream";
import {
  useTeleprompterScroll,
  WPM_PRESETS,
} from "@/hooks/use-teleprompter-scroll";
import TeleprompterOverlay from "@/components/teleprompter/teleprompter-overlay";
import RecorderReview from "@/components/teleprompter/recorder-review";

const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-40";

/**
 * TikTok-style teleprompter recorder: live camera with the chosen prompt
 * scrolling over the top. Composes the media stream and the scroll engine —
 * starting a recording also starts the scroll; stopping stops it and drops into
 * review. Camera + mic are enabled once on mount.
 */
export default function TeleprompterRecorder({
  text,
  onExit,
}: {
  text: string;
  onExit: () => void;
}) {
  const {
    cameraOn,
    micOn,
    isRecording,
    recordedBlob,
    recordedUrl,
    mediaError,
    videoRef,
    toggleCamera,
    toggleMic,
    startRecording,
    stopRecording,
    clearRecordedMedia,
    reattachStream,
  } = useMediaStream();
  const scroll = useTeleprompterScroll();
  const { play: scrollPlay, pause: scrollPause, reset: scrollReset } = scroll;
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
  useEffect(() => {
    if (isRecording && hasText) scrollPlay();
    else scrollPause();
  }, [isRecording, hasText, scrollPlay, scrollPause]);

  const toggleRecord = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!canRecord) return;
    scrollReset();
    startRecording();
  };

  const retake = () => {
    clearRecordedMedia();
    scroll.reset();
    void reattachStream(cameraOn);
  };

  if (recordedUrl && recordedBlob) {
    return (
      <RecorderReview url={recordedUrl} blob={recordedBlob} onRetake={retake} />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-6">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />

        {hasText && (
          <TeleprompterOverlay scrollRef={scroll.scrollRef} text={text} />
        )}

        {isRecording && (
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 backdrop-blur-md">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-xs font-bold text-white">REC</span>
          </div>
        )}

        {mediaError && (
          <div className="absolute inset-x-4 top-4 z-40 rounded-lg bg-red-950/80 px-3 py-2 text-xs font-bold text-red-200 backdrop-blur-md">
            {mediaError}
          </div>
        )}

        {/* Bottom control bar */}
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-5">
          {hasText && !isRecording && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white/70">Speed</span>
              {WPM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => scroll.setWpm(preset)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    scroll.wpm === preset
                      ? "bg-white text-black"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void toggleMic()}
              disabled={isRecording}
              className={iconBtn}
              title={micOn ? "Mute" : "Unmute"}
            >
              {micOn ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleRecord}
              disabled={!isRecording && !canRecord}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-transparent disabled:opacity-40"
              title={
                !canRecord
                  ? "Turn on your camera or mic first"
                  : isRecording
                    ? "Stop"
                    : "Record"
              }
            >
              <span
                className={
                  isRecording
                    ? "h-6 w-6 rounded-md bg-red-500"
                    : "h-12 w-12 rounded-full bg-red-500"
                }
              />
            </button>

            <button
              type="button"
              onClick={() => void toggleCamera()}
              disabled={isRecording}
              className={iconBtn}
              title={cameraOn ? "Camera off" : "Camera on"}
            >
              {cameraOn ? (
                <Camera className="h-4 w-4" />
              ) : (
                <CameraOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {!isRecording && (
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
