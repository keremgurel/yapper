"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECORDING_AUDIO_BITS_PER_SECOND,
  RECORDING_VIDEO_BITS_PER_SECOND,
  requestVideoStream,
  resetTrackZoom,
} from "@/lib/media";

export function useMediaStream() {
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- Internal helpers ---

  const attachStream = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = null;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, []);

  const replaceVideoTrack = useCallback(async () => {
    const previousStream = streamRef.current;
    const audioTracks = previousStream?.getAudioTracks() ?? [];

    videoRef.current?.pause();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    previousStream?.getVideoTracks().forEach((track) => {
      previousStream.removeTrack(track);
      track.stop();
    });

    const nextVideoStream = await requestVideoStream();
    const nextVideoTrack = nextVideoStream.getVideoTracks()[0];
    await resetTrackZoom(nextVideoTrack);

    const nextStream = new MediaStream();
    audioTracks.forEach((track) => nextStream.addTrack(track));
    nextStream.addTrack(nextVideoTrack);
    streamRef.current = nextStream;

    requestAnimationFrame(() => attachStream());
  }, [attachStream]);

  // --- Recorded media lifecycle ---

  const clearRecordedMedia = useCallback(() => {
    setRecordedBlob(null);
    setRecordedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    recorderRef.current = null;
    setIsPreparingDownload(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setIsPreparingDownload(true);
    try {
      recorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
        videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND,
      });

      recorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current.onstop = () => {
        const nextBlob = new Blob(chunksRef.current, { type: "video/webm" });
        const nextUrl = URL.createObjectURL(nextBlob);
        recorderRef.current = null;
        setIsRecording(false);
        setRecordedBlob(nextBlob);
        setRecordedUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setIsPreparingDownload(false);
      };
      recorderRef.current.start(200);
      setIsRecording(true);
    } catch {
      recorderRef.current = null;
      setIsPreparingDownload(false);
      throw new Error("Recording could not be started.");
    }
  }, []);

  // --- Camera & mic toggles ---

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
      await replaceVideoTrack();
      setCameraOn(true);
    } catch {
      alert("Camera access is required.");
    }
  }, [cameraOn, micOn, replaceVideoTrack]);

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
        const nextStream = cameraOn
          ? await (async () => {
              const nextVideoStream = await requestVideoStream();
              const nextAudioStream = await navigator.mediaDevices.getUserMedia(
                {
                  audio: true,
                },
              );
              const mergedStream = new MediaStream();
              nextVideoStream
                .getVideoTracks()
                .forEach((track) => mergedStream.addTrack(track));
              nextAudioStream
                .getAudioTracks()
                .forEach((track) => mergedStream.addTrack(track));
              return mergedStream;
            })()
          : await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
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

  // --- Reattach stream after reset ---

  const reattachStream = useCallback(
    async (isCameraOn: boolean) => {
      // Re-establish audio tracks if dead or missing
      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (!audioTrack || audioTrack.readyState !== "live") {
          if (audioTrack) streamRef.current.removeTrack(audioTrack);
          try {
            const freshAudio = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            streamRef.current.addTrack(freshAudio.getAudioTracks()[0]);
          } catch {
            // Will fail at next startRecording instead
          }
        }
      }

      if (!isCameraOn) return;

      const videoTrack = streamRef.current?.getVideoTracks()[0];

      if (videoTrack && videoTrack.readyState === "live") {
        requestAnimationFrame(() => {
          attachStream();
        });
        return;
      }

      replaceVideoTrack().catch(() => {
        alert("Camera preview could not be restored.");
      });
    },
    [attachStream, replaceVideoTrack],
  );

  // --- Download ---

  const downloadRecording = useCallback(() => {
    if (!recordedBlob) return;

    const downloadUrl = URL.createObjectURL(recordedBlob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `yapper-${new Date().toISOString().slice(0, 19)}.webm`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }, [recordedBlob]);

  // --- Effects ---

  useEffect(() => {
    if (cameraOn) {
      requestAnimationFrame(() => attachStream());
    }
  }, [attachStream, cameraOn]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordedUrl]);

  return {
    cameraOn,
    micOn,
    isRecording,
    recordedBlob,
    recordedUrl,
    isPreparingDownload,
    videoRef,
    toggleCamera,
    toggleMic,
    startRecording,
    stopRecording,
    clearRecordedMedia,
    reattachStream,
    downloadRecording,
  };
}
