import { describe, expect, it, vi } from "vitest";
import { streamBoundedMedia } from "@/lib/studio/audio/demux-audio";

describe("progressive transcription demux input", () => {
  it("appends monotonic chunks without combining the whole response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.enqueue(new Uint8Array([3]));
            controller.close();
          },
        }),
      ),
    );
    const starts: number[] = [];
    await streamBoundedMedia("blob:test", (buffer) => {
      starts.push((buffer as ArrayBuffer & { fileStart: number }).fileStart);
    });
    expect(starts).toEqual([0, 2]);
  });

  it("enforces the actual streamed cap without Content-Length", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(8));
            controller.enqueue(new Uint8Array([1]));
          },
        }),
      ),
    );
    await expect(
      streamBoundedMedia("blob:large", () => {}, undefined, 8),
    ).rejects.toThrow("media_too_large_for_browser_transcription");
  });

  it("aborts a noncooperative pending read", async () => {
    const abort = new AbortController();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new ReadableStream({ pull: () => new Promise(() => {}) })),
    );
    const pending = streamBoundedMedia("blob:stalled", () => {}, abort.signal);
    abort.abort();
    await expect(pending).rejects.toBeDefined();
  });

  it("stops reading on caller abort", async () => {
    const abort = new AbortController();
    let pulls = 0;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            pulls++;
            controller.enqueue(new Uint8Array([1]));
          },
        }),
      ),
    );
    await expect(
      streamBoundedMedia("blob:abort", () => abort.abort(), abort.signal),
    ).rejects.toBeDefined();
    expect(pulls).toBeLessThanOrEqual(2);
  });
});
