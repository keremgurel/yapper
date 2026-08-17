import { describe, expect, it } from "vitest";
import { importFailureMessage } from "@/lib/publish/import-failure";

describe("importFailureMessage", () => {
  it("tells a creator out of imports what actually happened", () => {
    expect(importFailureMessage("rate_limited")).toContain("this hour allows");
  });

  it("separates a missing connection from a missing file", () => {
    expect(importFailureMessage("not_connected")).toContain("Reconnect");
    expect(importFailureMessage("no_source_file")).toContain(
      "Instagram did not",
    );
  });

  it("falls back to the old sentence for anything unrecognised", () => {
    expect(importFailureMessage(undefined)).toContain("could not be prepared");
    expect(importFailureMessage("something_new")).toContain(
      "could not be prepared",
    );
  });
});
