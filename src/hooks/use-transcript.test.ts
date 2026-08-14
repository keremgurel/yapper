import { describe, expect, it } from "vitest";
import { TranscriptionRunFence } from "@/hooks/use-transcript";

describe("transcription run fencing", () => {
  it("supersedes the previous run and rejects its late completion", () => {
    const fence = new TranscriptionRunFence();
    const first = fence.begin();
    const second = fence.begin();
    expect(first.signal.aborted).toBe(true);
    expect(fence.owns(first)).toBe(false);
    expect(fence.owns(second)).toBe(true);
  });

  it("reset cancels and clears the active generation", () => {
    const fence = new TranscriptionRunFence();
    const active = fence.begin();
    fence.cancel("reset");
    expect(active.signal.aborted).toBe(true);
    expect(fence.current).toBeNull();
    expect(fence.owns(active)).toBe(false);
  });
});
