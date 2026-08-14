import { describe, expect, it } from "vitest";
import {
  MAX_TRANSCRIPT_RECOVERY_BYTES,
  transcriptRecoveryMediaType,
} from "@/hooks/use-transcript-recovery";

describe("transcript recovery attachment preflight", () => {
  it("rejects empty, oversized, and unsupported files before transport", () => {
    expect(
      transcriptRecoveryMediaType(
        new File([], "empty.wav", { type: "audio/wav" }),
      ),
    ).toBeNull();
    expect(
      transcriptRecoveryMediaType(
        new File(
          [new Uint8Array(MAX_TRANSCRIPT_RECOVERY_BYTES + 1)],
          "large.wav",
          {
            type: "audio/wav",
          },
        ),
      ),
    ).toBeNull();
    expect(
      transcriptRecoveryMediaType(
        new File(["x"], "notes.txt", { type: "text/plain" }),
      ),
    ).toBeNull();
  });

  it("infers allowlisted empty-MIME picker files", () => {
    expect(transcriptRecoveryMediaType(new File(["x"], "voice.m4a"))).toBe(
      "audio/x-m4a",
    );
    expect(transcriptRecoveryMediaType(new File(["x"], "camera.mp4"))).toBe(
      "video/mp4",
    );
    expect(
      transcriptRecoveryMediaType(new File(["x"], "unknown.bin")),
    ).toBeNull();
  });
});
