import { describe, expect, it } from "vitest";
import { failedSaveRetargets } from "@/lib/save-queue";

describe("failedSaveRetargets", () => {
  const saveA = async () => {};
  const saveB = async () => {};

  it("is false when no batch is pending (safe to re-merge and retry)", () => {
    expect(failedSaveRetargets(saveA, null)).toBe(false);
  });

  it("is false when the pending batch is still the same save", () => {
    expect(failedSaveRetargets(saveA, saveA)).toBe(false);
  });

  it("is true when the batch was re-pointed at a different save mid-flight", () => {
    // The caller switched records while saveA was in flight. Re-merging saveA's
    // failed fields into saveB's batch would write them to the wrong record.
    expect(failedSaveRetargets(saveA, saveB)).toBe(true);
  });
});
