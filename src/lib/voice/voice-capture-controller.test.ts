import { describe, expect, it, vi } from "vitest";
import {
  VoiceCaptureController,
  VOICE_CAPTURE_MAX_BYTES,
  VOICE_CAPTURE_MAX_DURATION_MS,
  VOICE_CAPTURE_TIMESLICE_MS,
  type VoiceCaptureErrorKind,
  type VoiceCapturePhase,
} from "./voice-capture-controller";

class FakeTrack {
  stops = 0;
  stop() {
    this.stops += 1;
  }
}

class FakeRecorder {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  timeslice: number | undefined;
  stops = 0;
  finishOnStop = true;

  start(timeslice?: number) {
    this.state = "recording";
    this.timeslice = timeslice;
  }

  stop() {
    if (this.state === "inactive") throw new DOMException("inactive");
    this.stops += 1;
    this.state = "inactive";
    if (this.finishOnStop) this.onstop?.();
  }

  emit(blob: Blob) {
    this.ondataavailable?.({ data: blob });
  }
}

function fakeStream(track = new FakeTrack()) {
  return {
    track,
    stream: { getTracks: () => [track] } as unknown as MediaStream,
  };
}

function createHarness(options?: {
  getUserMedia?: () => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream) => MediaRecorder;
  transcribe?: (blob: Blob, signal: AbortSignal) => Promise<string>;
  finishRecorderOnStop?: boolean;
}) {
  const phases: VoiceCapturePhase[] = [];
  const errors: { message: string | null; kind: VoiceCaptureErrorKind }[] = [];
  const streams: (MediaStream | null)[] = [];
  const recorders: FakeRecorder[] = [];
  const timers = new Map<number, () => void>();
  let timerID = 0;
  const defaultStream = fakeStream();
  const transcribe = vi.fn(
    options?.transcribe ?? (async () => "hello from the microphone"),
  );
  const controller = new VoiceCaptureController(
    {
      getUserMedia: options?.getUserMedia ?? (async () => defaultStream.stream),
      createRecorder: (stream) => {
        if (options?.createRecorder) return options.createRecorder(stream);
        const recorder = new FakeRecorder();
        recorder.finishOnStop = options?.finishRecorderOnStop ?? true;
        recorders.push(recorder);
        return recorder as unknown as MediaRecorder;
      },
      transcribe,
      setTimer: (callback) => {
        timerID += 1;
        timers.set(timerID, callback);
        return timerID as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: (timer) => {
        timers.delete(timer as unknown as number);
      },
    },
    {
      phase: (phase) => phases.push(phase),
      error: (message, kind) => errors.push({ message, kind }),
      stream: (stream) => streams.push(stream),
    },
  );
  return {
    controller,
    defaultStream,
    errors,
    phases,
    recorders,
    streams,
    timers,
    transcribe,
  };
}

describe("VoiceCaptureController", () => {
  it("records in bounded timeslices and sends the Blob without another copy", async () => {
    const harness = createHarness();
    await harness.controller.start();
    const recorder = harness.recorders[0]!;
    const audio = new Blob(["voice"], { type: "audio/webm" });
    recorder.emit(audio);

    const text = await harness.controller.stop();

    expect(recorder.timeslice).toBe(VOICE_CAPTURE_TIMESLICE_MS);
    expect(harness.transcribe).toHaveBeenCalledOnce();
    expect(harness.transcribe.mock.calls[0]![0]).toBeInstanceOf(Blob);
    expect(harness.transcribe.mock.calls[0]![0].size).toBe(audio.size);
    expect(text).toBe("hello from the microphone");
    expect(harness.defaultStream.track.stops).toBe(1);
    expect(harness.phases).toEqual(["recording", "transcribing", "idle"]);
  });

  it("discards a recording as soon as its cumulative byte budget is crossed", async () => {
    const harness = createHarness();
    await harness.controller.start();
    const oversized = {
      size: VOICE_CAPTURE_MAX_BYTES + 1,
      type: "audio/webm",
    } as Blob;

    harness.recorders[0]!.emit(oversized);
    const text = await harness.controller.stop();

    expect(text).toBe("");
    expect(harness.transcribe).not.toHaveBeenCalled();
    expect(harness.defaultStream.track.stops).toBe(1);
    expect(harness.errors.at(-1)).toEqual({
      message: "Voice notes can be up to 3.9 MB.",
      kind: "recording",
    });
  });

  it("stops and discards a recording at the duration ceiling", async () => {
    const harness = createHarness();
    await harness.controller.start();
    expect(harness.timers.size).toBe(1);

    harness.timers.values().next().value?.();
    const text = await harness.controller.stop();

    expect(VOICE_CAPTURE_MAX_DURATION_MS).toBe(120_000);
    expect(text).toBe("");
    expect(harness.transcribe).not.toHaveBeenCalled();
    expect(harness.defaultStream.track.stops).toBe(1);
    expect(harness.errors.at(-1)?.message).toContain("two minutes");
  });

  it("dispose stops the microphone and aborts an in-flight transcription", async () => {
    let uploadSignal: AbortSignal | undefined;
    const harness = createHarness({
      transcribe: async (_blob, signal) => {
        uploadSignal = signal;
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        throw new DOMException("Aborted", "AbortError");
      },
    });
    await harness.controller.start();
    harness.recorders[0]!.emit(new Blob(["voice"]));
    const stopping = harness.controller.stop();
    await Promise.resolve();

    harness.controller.dispose();
    const text = await stopping;

    expect(uploadSignal?.aborted).toBe(true);
    expect(text).toBe("");
    expect(harness.defaultStream.track.stops).toBe(1);
    expect(harness.errors).toEqual([{ message: null, kind: null }]);
  });

  it("dispose stops tracks immediately without waiting for MediaRecorder.onstop", async () => {
    const harness = createHarness({ finishRecorderOnStop: false });
    await harness.controller.start();

    harness.controller.dispose();

    expect(harness.recorders[0]!.stops).toBe(1);
    expect(harness.defaultStream.track.stops).toBe(1);
    expect(harness.timers.size).toBe(0);
  });

  it("stops an acquired stream when recorder construction fails", async () => {
    const stream = fakeStream();
    const harness = createHarness({
      getUserMedia: async () => stream.stream,
      createRecorder: () => {
        throw new Error("unsupported codec");
      },
    });

    await harness.controller.start();

    expect(stream.track.stops).toBe(1);
    expect(harness.phases.at(-1)).toBe("idle");
    expect(harness.errors.at(-1)).toEqual({
      message: "Couldn't start the microphone.",
      kind: "recording",
    });
  });

  it("stops a late permission stream after cancellation without creating a recorder", async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const harness = createHarness({ getUserMedia: () => permission });
    const late = fakeStream();
    const starting = harness.controller.start();

    harness.controller.cancel();
    resolveStream(late.stream);
    await starting;

    expect(late.track.stops).toBe(1);
    expect(harness.recorders).toHaveLength(0);
    expect(harness.phases.at(-1)).toBe("idle");
  });

  it("cancel aborts a transcription and does not surface a late failure", async () => {
    const harness = createHarness({
      transcribe: async (_blob, signal) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        throw new Error("late provider failure");
      },
    });
    await harness.controller.start();
    harness.recorders[0]!.emit(new Blob(["voice"]));
    const stopping = harness.controller.stop();
    await Promise.resolve();

    harness.controller.cancel();
    expect(await stopping).toBe("");
    expect(harness.phases.at(-1)).toBe("idle");
    expect(harness.errors.at(-1)).toEqual({ message: null, kind: null });
  });
});
