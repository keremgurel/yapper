export type VoiceCapturePhase = "idle" | "recording" | "transcribing";
export type VoiceCaptureErrorKind =
  | "permission"
  | "unavailable"
  | "recording"
  | null;

export const VOICE_CAPTURE_MAX_BYTES = 3_900_000;
export const VOICE_CAPTURE_MAX_DURATION_MS = 120_000;
export const VOICE_CAPTURE_TIMESLICE_MS = 1_000;

type VoiceCaptureEvents = {
  phase(value: VoiceCapturePhase): void;
  error(message: string | null, kind: VoiceCaptureErrorKind): void;
  stream(value: MediaStream | null): void;
};

type VoiceCaptureDependencies = {
  getUserMedia(): Promise<MediaStream>;
  createRecorder(stream: MediaStream): MediaRecorder;
  transcribe(blob: Blob, signal: AbortSignal): Promise<string>;
  setTimer(
    callback: () => void,
    delayMs: number,
  ): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
};

class VoiceRecording {
  private readonly chunks: Blob[] = [];
  private bytes = 0;
  private discard = false;
  private settled = false;
  private tracksStopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resolveStop: ((blob: Blob | null) => void) | null = null;
  private readonly stopped: Promise<Blob | null>;

  constructor(
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder,
    private readonly dependencies: VoiceCaptureDependencies,
    private readonly onLimit: (message: string) => void,
    private readonly onSettled: () => void,
  ) {
    this.stopped = new Promise((resolve) => {
      this.resolveStop = resolve;
    });
  }

  start() {
    this.recorder.ondataavailable = (event) => {
      if (this.discard || event.data.size === 0) return;
      this.bytes += event.data.size;
      if (this.bytes > VOICE_CAPTURE_MAX_BYTES) {
        this.discardAndStop("Voice notes can be up to 3.9 MB.");
        return;
      }
      this.chunks.push(event.data);
    };
    this.recorder.onerror = () => {
      this.discardAndStop("Couldn't finish the recording.");
    };
    this.recorder.onstop = () => this.settle();
    this.timer = this.dependencies.setTimer(() => {
      this.discardAndStop("Voice notes can be up to two minutes long.");
    }, VOICE_CAPTURE_MAX_DURATION_MS);
    this.recorder.start(VOICE_CAPTURE_TIMESLICE_MS);
  }

  stop(discard = false): Promise<Blob | null> {
    this.discard ||= discard;
    this.clearDurationTimer();
    if (this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        this.settle();
      }
    } else {
      this.settle();
    }
    // `MediaRecorder.stop()` queues its final events. The microphone itself
    // does not need to stay live while those buffered bytes are delivered.
    this.stopTracks();
    return this.stopped;
  }

  private discardAndStop(message: string) {
    if (this.discard) return;
    this.discard = true;
    this.chunks.length = 0;
    this.onLimit(message);
    void this.stop(true);
  }

  private settle() {
    if (this.settled) return;
    this.settled = true;
    this.clearDurationTimer();
    this.stopTracks();
    const type = this.recorder.mimeType || this.chunks[0]?.type || "audio/webm";
    const blob = this.discard ? null : new Blob(this.chunks, { type });
    this.chunks.length = 0;
    this.onSettled();
    this.resolveStop?.(blob);
    this.resolveStop = null;
  }

  private clearDurationTimer() {
    if (this.timer === null) return;
    this.dependencies.clearTimer(this.timer);
    this.timer = null;
  }

  private stopTracks() {
    if (this.tracksStopped) return;
    this.tracksStopped = true;
    this.stream.getTracks().forEach((track) => track.stop());
  }
}

export class VoiceCaptureController {
  private generation = 0;
  private disposed = false;
  private recording: VoiceRecording | null = null;
  private upload: AbortController | null = null;

  constructor(
    private readonly dependencies: VoiceCaptureDependencies,
    private readonly events: VoiceCaptureEvents,
  ) {}

  async start(): Promise<void> {
    this.cancelResources();
    const generation = ++this.generation;
    this.events.error(null, null);
    let requestedStream: MediaStream | null = null;
    try {
      const stream = await this.dependencies.getUserMedia();
      requestedStream = stream;
      if (!this.owns(generation)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = this.dependencies.createRecorder(stream);
      const recording = new VoiceRecording(
        stream,
        recorder,
        this.dependencies,
        (message) => {
          if (!this.owns(generation)) return;
          this.events.error(message, "recording");
          this.events.phase("idle");
        },
        () => {
          if (this.recording === recording) this.recording = null;
          if (this.owns(generation)) this.events.stream(null);
        },
      );
      this.recording = recording;
      requestedStream = null;
      this.events.stream(stream);
      recording.start();
      this.events.phase("recording");
    } catch (cause) {
      requestedStream?.getTracks().forEach((track) => track.stop());
      if (!this.owns(generation)) return;
      const name = cause instanceof DOMException ? cause.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.events.error("Microphone access is off.", "permission");
      } else if (name === "NotFoundError") {
        this.events.error("No microphone was found.", "unavailable");
      } else {
        this.events.error("Couldn't start the microphone.", "recording");
      }
      this.events.phase("idle");
    }
  }

  async stop(): Promise<string> {
    const generation = this.generation;
    const recording = this.recording;
    if (!recording) return "";
    const blob = await recording.stop();
    if (!blob || blob.size === 0 || !this.owns(generation)) {
      if (this.owns(generation)) this.events.phase("idle");
      return "";
    }

    this.events.phase("transcribing");
    const upload = new AbortController();
    this.upload = upload;
    try {
      const text = await this.dependencies.transcribe(blob, upload.signal);
      if (!this.owns(generation)) return "";
      this.events.phase("idle");
      return text;
    } catch {
      if (!this.owns(generation) || upload.signal.aborted) return "";
      this.events.error("Couldn't transcribe", "recording");
      this.events.phase("idle");
      return "";
    } finally {
      if (this.upload === upload) this.upload = null;
    }
  }

  cancel() {
    this.cancelResources();
    this.generation += 1;
    if (this.disposed) return;
    this.events.error(null, null);
    this.events.stream(null);
    this.events.phase("idle");
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelResources();
    this.generation += 1;
  }

  private cancelResources() {
    this.upload?.abort();
    this.upload = null;
    const recording = this.recording;
    this.recording = null;
    if (recording) void recording.stop(true);
  }

  private owns(generation: number) {
    return !this.disposed && generation === this.generation;
  }
}
