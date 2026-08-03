import { describe, expect, it } from "vitest";
import { buildExpandMessages, parseExpansion } from "@/lib/ideas/expand-prompt";

describe("parseExpansion", () => {
  const full = JSON.stringify({
    title: "Why filler words kill authority",
    pillar: "Speaking",
    hooks: ["Stop saying um.", "Your filler words cost you.", "Sound sharp."],
    outline: ["Hook", "The cost", "The fix", "CTA"],
    keyPoints: ["Fillers signal doubt", "Pause instead", "Practice on camera"],
    script: "Every time you say um, you hand away authority. Here is the fix.",
  });

  it("parses a clean JSON response", () => {
    const e = parseExpansion(full)!;
    expect(e.title).toBe("Why filler words kill authority");
    expect(e.pillar).toBe("Speaking");
    expect(e.hooks).toHaveLength(3);
    expect(e.outline).toContain("The fix");
    expect(e.script).toContain("authority");
  });

  it("tolerates code fences and surrounding prose", () => {
    const e = parseExpansion("Sure!\n```json\n" + full + "\n```")!;
    expect(e.title).toBe("Why filler words kill authority");
  });

  it("defaults missing arrays to empty and pillar to null", () => {
    const e = parseExpansion(JSON.stringify({ title: "T", script: "S" }))!;
    expect(e.hooks).toEqual([]);
    expect(e.outline).toEqual([]);
    expect(e.keyPoints).toEqual([]);
    expect(e.pillar).toBeNull();
  });

  it("returns null without a title (nothing usable)", () => {
    expect(parseExpansion(JSON.stringify({ script: "S" }))).toBeNull();
  });

  it("returns null on non-JSON", () => {
    expect(parseExpansion("the model refused")).toBeNull();
  });

  it("drops non-string and blank array entries", () => {
    const e = parseExpansion(
      JSON.stringify({ title: "T", hooks: ["ok", "", 3, null, "  x "] }),
    )!;
    expect(e.hooks).toEqual(["ok", "x"]);
  });

  it("parses reference-specific sections without requiring a fixed template", () => {
    const e = parseExpansion(
      JSON.stringify({
        title: "CELPIP Listening Be Like",
        pillar: "Humor",
        format: "Audio-led reaction sketch",
        summary:
          "The confusing listening audio carries the joke while the performer reacts.",
        sections: [
          {
            label: "Joke mechanics",
            kind: "bullets",
            items: [
              "Begin confident",
              "Escalate the audio",
              "Hold on the confused reaction",
            ],
          },
          {
            label: "CELPIP recreation",
            kind: "script",
            text: "[Audio] A deliberately overqualified answer. [Visual] Freeze.",
          },
        ],
      }),
    )!;

    expect(e.format).toBe("Audio-led reaction sketch");
    expect(e.sections).toHaveLength(2);
    expect(e.sections?.[0]?.label).toBe("Joke mechanics");
    expect(e.hooks).toEqual([]);
  });

  it("drops malformed or empty adaptive sections", () => {
    const e = parseExpansion(
      JSON.stringify({
        title: "T",
        sections: [
          { label: "Empty", kind: "bullets", items: [] },
          { label: "Wrong", kind: "table", text: "x" },
          { label: "Useful", kind: "paragraph", text: "Keep this." },
        ],
      }),
    )!;
    expect(e.sections).toEqual([
      { label: "Useful", kind: "paragraph", text: "Keep this." },
    ]);
  });
});

describe("buildExpandMessages", () => {
  it("frames an original idea from the creator's words", () => {
    const { user } = buildExpandMessages(
      { transcript: "video about filler words" },
      "original",
      [],
    );
    expect(user).toContain("brain-dumped an original idea");
    expect(user).toContain("filler words");
  });

  it("includes the reference for an inspiration link", () => {
    const { user } = buildExpandMessages(
      { url: "https://x", source: { url: "https://x", title: "A reel" } },
      "inspiration",
      [],
    );
    expect(user).toContain("A reel");
    expect(user).toContain("riff on");
  });

  it("grounds a written resource in its stored summary", () => {
    const { system, user } = buildExpandMessages(
      {
        url: "https://example.com/research.pdf",
        source: {
          url: "https://example.com/research.pdf",
          title: "A research paper",
          summary: "The study found that deliberate pauses improved recall.",
          referenceType: "research-paper",
        },
      },
      "inspiration",
      [],
    );
    expect(system).toContain("written resource");
    expect(user).toContain("deliberate pauses");
    expect(user).toContain("research-paper");
  });

  it("lists the creator's pillars in the system prompt when provided", () => {
    const { system } = buildExpandMessages({ transcript: "x" }, "original", [
      "Speaking",
      "Mindset",
    ]);
    expect(system).toContain("Speaking, Mindset");
  });

  it("keeps audio-led comedy in its actual format", () => {
    const { system, user } = buildExpandMessages(
      {
        transcript: "recreate this for CELPIP",
        source: {
          url: "https://instagram.com/reel/example",
          title: "IELTS listening test be like",
          transcript: "The source audio becomes increasingly confusing.",
        },
      },
      "semi-original",
      [],
    );
    expect(system).toContain("audio-led joke");
    expect(system).toContain("Never force");
    expect(user).toContain("increasingly confusing");
  });
});
