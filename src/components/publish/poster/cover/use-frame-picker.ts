"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Input, VideoSampleSink } from "mediabunny";
import { nearestFrame, presentationTimes } from "./frame-timeline";

type Engine = {
  input: Input;
  sink: VideoSampleSink;
  times: number[];
  running: boolean;
  disposed: boolean;
};

/** Decode the indexed frame once; preview and cover share those exact pixels. */
export function useFramePicker(mediaUrl: string | null, initialTime: number) {
  const engine = useRef<Engine | null>(null);
  const selected = useRef(0);
  const initial = useRef(initialTime);
  const [revision, setRevision] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frame, setFrame] = useState<{ image: string; time: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decode = useCallback(async () => {
    const current = engine.current;
    if (!current || current.running || current.disposed) return;
    current.running = true;
    setBusy(true);
    setError("");
    try {
      // Coalesce rapid input, never let two decodes race to update the cover.
      while (!current.disposed) {
        const wanted = selected.current;
        const time = current.times[wanted];
        const timer = setTimeout(() => current.input.dispose(), 30_000);
        const sample = await current.sink
          .getSample(time)
          .finally(() => clearTimeout(timer));
        if (!sample) throw new Error("missing_frame");
        try {
          if (current.disposed) return;
          if (wanted !== selected.current) continue;
          if (Math.abs(sample.timestamp - time) > 0.00001)
            throw new Error("wrong_frame");
          const canvas = document.createElement("canvas");
          canvas.width = 1080;
          canvas.height = 1920;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("canvas");
          const scale = Math.max(
            canvas.width / sample.displayWidth,
            canvas.height / sample.displayHeight,
          );
          const width = sample.displayWidth * scale;
          const height = sample.displayHeight * scale;
          sample.draw(
            context,
            (canvas.width - width) / 2,
            (canvas.height - height) / 2,
            width,
            height,
          );
          setFrame({ image: canvas.toDataURL("image/jpeg", 0.9), time });
          break;
        } finally {
          sample.close();
        }
      }
    } catch {
      if (!current.disposed)
        setError("This frame could not be decoded. Retry to reload the video.");
    } finally {
      current.running = false;
      if (!current.disposed) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!mediaUrl) return;
    let live = true;
    let input: Input | undefined;
    setTimes([]);
    setFrame(null);
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      if (live) {
        live = false;
        input?.dispose();
        setBusy(false);
        setError("The video took too long to load. Retry to load its frames.");
      }
    }, 30_000);
    void (async () => {
      try {
        const {
          Input,
          UrlSource,
          ALL_FORMATS,
          EncodedPacketSink,
          VideoSampleSink,
        } = await import("mediabunny");
        if (!live) return;
        input = new Input({
          source: new UrlSource(mediaUrl),
          formats: ALL_FORMATS,
        });
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode()))
          throw new Error("unsupported_video");
        const timestamps: number[] = [];
        for await (const packet of new EncodedPacketSink(track).packets(
          undefined,
          undefined,
          { metadataOnly: true },
        )) {
          if (!live) return;
          timestamps.push(packet.timestamp);
        }
        const timeline = presentationTimes(timestamps);
        const end = await track.computeDuration();
        if (!timeline.length) throw new Error("empty_video");
        if (!live) return;
        clearTimeout(timer);
        engine.current = {
          input,
          sink: new VideoSampleSink(track),
          times: timeline,
          running: false,
          disposed: false,
        };
        const start = nearestFrame(timeline, initial.current);
        selected.current = start;
        setIndex(start);
        setTimes(timeline);
        setDuration(end);
        void decode();
      } catch {
        input?.dispose();
        if (live) {
          setBusy(false);
          setError(
            "This video could not be decoded accurately in this browser. Retry or use an MP4 with H.264 video.",
          );
        }
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      live = false;
      clearTimeout(timer);
      if (engine.current) engine.current.disposed = true;
      engine.current = null;
      input?.dispose();
    };
  }, [mediaUrl, revision, decode]);

  const select = useCallback(
    (next: number) => {
      const current = engine.current;
      if (!current || !Number.isFinite(next)) return;
      const bounded = Math.max(
        0,
        Math.min(current.times.length - 1, Math.round(next)),
      );
      selected.current = bounded;
      setIndex(bounded);
      void decode();
    },
    [decode],
  );
  const seek = (time: number) => select(nearestFrame(times, time));
  const step = (frames: number) => select(selected.current + frames);
  const jump = (seconds: number) =>
    seek((times[selected.current] ?? 0) + seconds);
  const retry = () => {
    initial.current = times[selected.current] ?? initial.current;
    setRevision((value) => value + 1);
  };

  return {
    duration,
    time: times[index] ?? 0,
    index,
    frameCount: times.length,
    frame,
    seek,
    select,
    step,
    jump,
    busy,
    error,
    retry,
  };
}
