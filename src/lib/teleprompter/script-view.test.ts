import { describe, expect, it } from "vitest";
import {
  hasTeleprompterText,
  teleprompterText,
  type PromptSource,
} from "@/lib/teleprompter/script-view";

const idea = (over: Partial<PromptSource> = {}): PromptSource => ({
  hooks: [],
  points: [],
  cta: "",
  script: null,
  ...over,
});

describe("teleprompterText", () => {
  it("shows nothing for the off view", () => {
    expect(teleprompterText(idea({ script: "anything" }), "off")).toBe("");
  });

  it("shows the trimmed script for the script view", () => {
    expect(teleprompterText(idea({ script: "  Read this.  " }), "script")).toBe(
      "Read this.",
    );
  });

  it("falls back to the notes view when the script view has no script", () => {
    const source = idea({ hooks: ["Hook"], points: ["Point"], cta: "CTA" });
    // No script written yet: the script view must degrade to the beats, not blank.
    expect(teleprompterText(source, "script")).toBe(
      teleprompterText(source, "notes"),
    );
    expect(teleprompterText(source, "script")).not.toBe("");
  });

  it("builds notes as first-hook, bulleted points, then cta", () => {
    const text = teleprompterText(
      idea({
        hooks: ["", "  ", "Real hook"],
        points: ["First", "  ", "Second"],
        cta: "Subscribe",
      }),
      "notes",
    );
    expect(text).toBe("Real hook\n\n• First\n• Second\n\nSubscribe");
  });

  it("omits sections that are empty", () => {
    expect(teleprompterText(idea({ points: ["Only point"] }), "notes")).toBe(
      "• Only point",
    );
    expect(teleprompterText(idea({ cta: "Just a CTA" }), "notes")).toBe(
      "Just a CTA",
    );
  });
});

describe("hasTeleprompterText", () => {
  it("is false when a view would render nothing", () => {
    expect(hasTeleprompterText(idea({ hooks: ["Hook"] }), "off")).toBe(false);
    expect(hasTeleprompterText(idea(), "notes")).toBe(false);
  });

  it("is true when there is something to show", () => {
    expect(hasTeleprompterText(idea({ hooks: ["Hook"] }), "notes")).toBe(true);
    expect(hasTeleprompterText(idea({ script: "s" }), "script")).toBe(true);
  });
});
