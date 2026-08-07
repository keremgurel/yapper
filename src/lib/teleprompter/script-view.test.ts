import { describe, expect, it } from "vitest";
import {
  hasTeleprompterText,
  teleprompterText,
  type PromptSource,
} from "@/lib/teleprompter/script-view";

const idea = (over: Partial<PromptSource> = {}): PromptSource => ({
  hooks: [],
  blocks: [],
  script: null,
  ...over,
});

const bullets = (...items: string[]) =>
  ({ label: "Key points", kind: "bullets", items }) as const;

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
    const source = idea({ hooks: ["Hook"], blocks: [bullets("Point")] });
    // No script written yet: the script view must degrade to the beats, not blank.
    expect(teleprompterText(source, "script")).toBe(
      teleprompterText(source, "notes"),
    );
    expect(teleprompterText(source, "script")).not.toBe("");
  });

  it("builds notes as first-hook then bulleted beats", () => {
    const text = teleprompterText(
      idea({
        hooks: ["", "  ", "Real hook"],
        blocks: [bullets("First", "  ", "Second")],
      }),
      "notes",
    );
    expect(text).toBe("Real hook\n\n• First\n• Second");
  });

  it("renders a prose block as its own paragraph", () => {
    const text = teleprompterText(
      idea({
        blocks: [
          { label: "The angle", kind: "paragraph", text: "Say this bit." },
          bullets("Then this"),
        ],
      }),
      "notes",
    );
    expect(text).toBe("Say this bit.\n\n• Then this");
  });

  /** Section labels are the one thing a creator must not read out by mistake,
   * and a script block is prose for the other view. Neither belongs here. */
  it("omits section labels and script blocks", () => {
    const text = teleprompterText(
      idea({
        blocks: [
          bullets("Beat"),
          { label: "Draft", kind: "script", text: "Full narration here." },
        ],
      }),
      "notes",
    );
    expect(text).toBe("• Beat");
    expect(text).not.toContain("Key points");
  });

  it("omits sections that are empty", () => {
    expect(
      teleprompterText(idea({ blocks: [bullets("Only point")] }), "notes"),
    ).toBe("• Only point");
    expect(
      teleprompterText(
        idea({ blocks: [{ label: "Empty", kind: "paragraph", text: "  " }] }),
        "notes",
      ),
    ).toBe("");
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
