import { describe, expect, it, vi } from "vitest";
import {
  AudioPreparationAdmission,
  decodeStreamingCompatibilityAudio,
  optionalAsrChunks,
} from "@/lib/studio/audio-decode";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("AudioPreparationAdmission", () => {
  it("keeps exact single ownership across queued handoff and new arrivals", async () => {
    const admission = new AudioPreparationAdmission();
    const firstRelease = deferred();
    const secondRelease = deferred();
    const secondStarted = deferred();
    let active = 0;
    let maxActive = 0;
    const starts: number[] = [];
    const run = (id: number, gate: Promise<void>) =>
      admission.run(async () => {
        starts.push(id);
        if (id === 2) secondStarted.resolve();
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate;
        active -= 1;
      });

    const first = run(1, firstRelease.promise);
    await Promise.resolve();
    const second = run(2, secondRelease.promise);
    firstRelease.resolve();
    const third = run(3, Promise.resolve());
    await secondStarted.promise;

    expect(starts).toEqual([1, 2]);
    secondRelease.resolve();
    await Promise.all([first, second, third]);
    expect(starts).toEqual([1, 2, 3]);
    expect(maxActive).toBe(1);
  });

  it("skips a canceled waiter without blocking the next one", async () => {
    const admission = new AudioPreparationAdmission();
    const firstRelease = deferred();
    const controller = new AbortController();
    const starts: number[] = [];

    const first = admission.run(async () => {
      starts.push(1);
      await firstRelease.promise;
    });
    await Promise.resolve();
    const canceled = admission.run(async () => {
      starts.push(2);
    }, controller.signal);
    const third = admission.run(async () => {
      starts.push(3);
    });

    controller.abort();
    firstRelease.resolve();
    await expect(canceled).rejects.toMatchObject({ name: "AbortError" });
    await Promise.all([first, third]);
    expect(starts).toEqual([1, 3]);
  });

  it("releases ownership when cancellation lands after queued handoff", async () => {
    const admission = new AudioPreparationAdmission();
    const firstRelease = deferred();
    const controller = new AbortController();
    const starts: number[] = [];

    const first = admission.run(async () => {
      starts.push(1);
      await firstRelease.promise;
    });
    await Promise.resolve();
    const handedOff = admission.run(async () => {
      starts.push(2);
    }, controller.signal);
    const third = admission.run(async () => {
      starts.push(3);
    });

    // Release resolves the queued acquire; abort before that continuation gets
    // to its guarded work. Its finally must still transfer ownership onward.
    firstRelease.resolve();
    queueMicrotask(() => controller.abort());

    await expect(handedOff).rejects.toMatchObject({ name: "AbortError" });
    await Promise.all([first, third]);
    expect(starts).toEqual([1, 3]);
  });
});

describe("optional ASR preparation", () => {
  it("does not build or materialize an ASR chunk plan when disabled", () => {
    const build = vi.fn(() => {
      throw new Error("must not materialize");
    });

    expect(optionalAsrChunks(false, build)).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });
});

type MediabunnyLoader = NonNullable<
  NonNullable<
    Parameters<typeof decodeStreamingCompatibilityAudio>[3]
  >["loadMediabunny"]
>;
type MediabunnyModule = Awaited<ReturnType<MediabunnyLoader>>;

function fakeMediabunny(options: {
  duration: number;
  samples?: unknown[];
  onSource?: () => void;
  onDispose?: () => void;
}): MediabunnyModule {
  class FakeUrlSource {
    constructor() {
      options.onSource?.();
    }
  }
  class FakeInput {
    async getPrimaryAudioTrack() {
      return {
        canDecode: async () => true,
        computeDuration: async () => options.duration,
      };
    }
    dispose() {
      options.onDispose?.();
    }
  }
  class FakeAudioSampleSink {
    async *samples() {
      for (const sample of options.samples ?? []) yield sample;
    }
  }
  return {
    Input: FakeInput,
    UrlSource: FakeUrlSource,
    AudioSampleSink: FakeAudioSampleSink,
    WEBM: {},
    MATROSKA: {},
    OGG: {},
  } as unknown as MediabunnyModule;
}

describe("bounded WebM/Opus compatibility decoding", () => {
  it("aborts during the lazy import before constructing a source", async () => {
    const controller = new AbortController();
    let sourceCount = 0;
    let resolve!: (module: MediabunnyModule) => void;
    const loading = new Promise<MediabunnyModule>((next) => {
      resolve = next;
    });
    const pending = decodeStreamingCompatibilityAudio(
      "blob:recording",
      controller.signal,
      undefined,
      { loadMediabunny: () => loading },
    );

    controller.abort();
    resolve(
      fakeMediabunny({
        duration: 1,
        onSource: () => {
          sourceCount += 1;
        },
      }),
    );

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(sourceCount).toBe(0);
  });

  it("accepts the full ten-minute envelope without a large test allocation", async () => {
    let disposeCount = 0;
    const output = await decodeStreamingCompatibilityAudio(
      "blob:recording",
      new AbortController().signal,
      undefined,
      {
        loadMediabunny: async () =>
          fakeMediabunny({
            duration: 600,
            onDispose: () => {
              disposeCount += 1;
            },
          }),
        targetRate: 1,
      },
    );

    expect(output).toHaveLength(600);
    expect(disposeCount).toBe(1);
  });

  it("rejects overlong media and disposes the source", async () => {
    let disposeCount = 0;
    await expect(
      decodeStreamingCompatibilityAudio(
        "blob:recording",
        new AbortController().signal,
        undefined,
        {
          loadMediabunny: async () =>
            fakeMediabunny({
              duration: 601,
              onDispose: () => {
                disposeCount += 1;
              },
            }),
          targetRate: 1,
        },
      ),
    ).rejects.toThrow("browser_audio_decode_unsupported");
    expect(disposeCount).toBe(1);
  });

  it("closes the current sample and disposes input on mid-sample abort", async () => {
    const controller = new AbortController();
    let closeCount = 0;
    let disposeCount = 0;
    const sample = {
      numberOfFrames: 1,
      numberOfChannels: 1,
      timestamp: 0,
      duration: 1,
      copyTo(output: Float32Array) {
        output[0] = 0.5;
        controller.abort();
      },
      close() {
        closeCount += 1;
      },
    };

    await expect(
      decodeStreamingCompatibilityAudio(
        "blob:recording",
        controller.signal,
        undefined,
        {
          loadMediabunny: async () =>
            fakeMediabunny({
              duration: 1,
              samples: [sample],
              onDispose: () => {
                disposeCount += 1;
              },
            }),
          targetRate: 1,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(closeCount).toBe(1);
    expect(disposeCount).toBeGreaterThanOrEqual(1);
  });
});
