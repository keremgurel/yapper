import { describe, expect, it } from "vitest";
import { StudioTranscriptionGate } from "@/lib/studio/transcription-operation";

describe("StudioTranscriptionGate", () => {
  it("rejects direct, recaption, and auto-edit overlap", () => {
    const gate = new StudioTranscriptionGate();
    const direct = gate.begin();

    expect(direct).not.toBeNull();
    expect(gate.begin()).toBeNull();
    expect(gate.begin()).toBeNull();
    expect(gate.current).toBe(direct);
  });

  it("cancel releases for a handoff and stale release cannot clear it", () => {
    const gate = new StudioTranscriptionGate();
    const first = gate.begin()!;

    gate.cancel();
    expect(first.signal.aborted).toBe(true);
    expect(gate.begin()).toBeNull();
    gate.release(first);
    const next = gate.begin()!;
    gate.release(first);

    expect(gate.current).toBe(next);
    gate.release(next);
    expect(gate.current).toBeNull();
  });
});
