import { describe, expect, it } from "vitest";
import { forFormat } from "@/lib/brain/context/server";
import type { BrainSnapshot } from "@/lib/brain/context/types";
import {
  chaptersIn,
  estimatedMinutes,
  spokenWordCount,
  tidyLongScript,
} from "./chapters";
import { expansionFromVersion, materialFromInput } from "./first-draft";
import {
  buildVersionMessages,
  parseVersionOutput,
  type WrittenVersion,
} from "./prompt";
import { versionInput, versionSource } from "./stored";
import { guardVersion } from "./write";

const context = { section: "", pillarNames: ["Educational", "Ship Log"] };
const material = {
  title: "Rory prompt for first customers",
  sourceTranscript: "He ran campaigns for Amex.",
};

describe("buildVersionMessages", () => {
  it("writes long-form as one script with ## chapters and no timestamps", () => {
    const { system } = buildVersionMessages("long", material, null, context);
    expect(system).toContain("'## '");
    expect(system).toContain("No timestamps");
    expect(system).toContain("never 'Intro'");
    expect(system).toContain("[B-ROLL: ...]");
    expect(system).toContain("'but' or 'therefore'");
  });

  it("asks a first draft for a pillar and summary, an adaptation for neither", () => {
    expect(
      buildVersionMessages("article", material, null, context).system,
    ).toContain('"pillar"');
    const from = {
      format: "short" as const,
      title: "T",
      alternatives: ["A hook"],
      script: "Words.",
      keyPoints: [],
    };
    const adapted = buildVersionMessages("article", material, from, context);
    expect(adapted.system).not.toContain('"pillar"');
    expect(adapted.system).toContain("The short below is the thesis");
    expect(adapted.user).toContain("Hooks:\n- A hook");
    expect(adapted.user).toContain("He ran campaigns for Amex.");
  });

  it("keeps shorts to 80 to 130 words and ending on the payoff", () => {
    const { system } = buildVersionMessages("short", material, null, context);
    expect(system).toContain("80 to 130 spoken words");
    expect(system).toContain("End on the payoff");
  });
});

describe("parseVersionOutput", () => {
  it("reads the JSON and falls back to the first alternative for a title", () => {
    const parsed = parseVersionOutput(
      "article",
      'Sure: {"alternatives":["Headline"],"dek":"For founders.","script":"## One\\nBody","keyPoints":["a"]}',
    );
    expect(parsed).toMatchObject({
      title: "Headline",
      dek: "For founders.",
      keyPoints: ["a"],
    });
  });

  it("rejects output without a script", () => {
    expect(parseVersionOutput("long", '{"title":"x"}')).toBeNull();
    expect(parseVersionOutput("long", "not json")).toBeNull();
  });
});

describe("chapters", () => {
  const script =
    "## Why logic fails\nPeople buy on feeling.\n[B-ROLL: Amex ad]\n\n## Who Rory is\nHe ran Ogilvy campaigns for years.";

  it("counts spoken words only", () => {
    expect(spokenWordCount(script)).toBe(10);
    expect(chaptersIn(script)).toEqual([
      { title: "Why logic fails", words: 4 },
      { title: "Who Rory is", words: 6 },
    ]);
  });

  it("estimates minutes at 150 words a minute", () => {
    expect(estimatedMinutes("word ".repeat(1500))).toBe(10);
    expect(estimatedMinutes("hi")).toBe(0.5);
  });

  it("strips timestamps and opens on a chapter", () => {
    expect(tidyLongScript("## 2:15 Logic doesn't sell\nText", "x")).toBe(
      "## Logic doesn't sell\nText",
    );
    expect(tidyLongScript("## (0:00) - Cold open", "x")).toBe("## Cold open");
    expect(
      tidyLongScript("You buy on feeling.\n## Two", "The real reason"),
    ).toBe("## The real reason\n\nYou buy on feeling.\n## Two");
  });
});

describe("guardVersion", () => {
  const base: WrittenVersion = {
    title: "The only marketing thinker I trust",
    alternatives: ["If you're stuck marketing, steal this."],
    script: "",
    dek: null,
    keyPoints: [],
    pillar: "Educational videos showing how",
    summary: null,
  };

  it("drops a short's restated opener, files the pillar, and removes dashes", () => {
    const short = guardVersion(
      "short",
      {
        ...base,
        script:
          "If you're stuck marketing, steal this. People buy on feeling — not logic.",
      },
      ["Educational"],
    );
    expect(short.script).toBe("People buy on feeling, not logic.");
    expect(short.pillar).toBe("Educational");
  });

  it("gives a long-form script its first chapter", () => {
    const long = guardVersion("long", { ...base, script: "Cold words." }, []);
    expect(
      long.script.startsWith("## The only marketing thinker I trust"),
    ).toBe(true);
  });
});

describe("stored versions", () => {
  it("round-trips a written article through the stored shape", () => {
    const written: WrittenVersion = {
      title: "Headline",
      alternatives: ["Headline", "Other"],
      script: "## One\nBody",
      dek: "For founders.",
      keyPoints: ["a", "b"],
      pillar: null,
      summary: null,
    };
    const input = versionInput(written, "short");
    expect(input.writtenFrom).toBe("short");
    const source = versionSource("article", {
      title: input.title,
      hooks: input.hooks,
      blocks: input.blocks,
      script: input.script,
    });
    expect(source).toEqual({
      format: "article",
      title: "Headline",
      alternatives: ["Headline", "Other"],
      script: "## One\nBody",
      keyPoints: ["a", "b"],
    });
  });

  it("reads a lead's script from its script block when the column is empty", () => {
    expect(
      versionSource("short", {
        hooks: [],
        blocks: [{ label: "Script", kind: "script", text: "Spoken." }],
        script: null,
      }).script,
    ).toBe("Spoken.");
  });

  it("turns a composer input into material and a draft into an expansion", () => {
    expect(
      materialFromInput({
        transcript: "break this down for founders",
        url: "https://youtu.be/x",
      }),
    ).toMatchObject({
      title: "break this down for founders",
      sourceUrl: "https://youtu.be/x",
    });
    const expansion = expansionFromVersion({
      title: "T",
      alternatives: ["T"],
      script: "## A\nB",
      dek: "D",
      keyPoints: ["k"],
      pillar: "Ship Log",
      summary: "S",
    });
    expect(expansion.sections).toEqual([
      { label: "Dek", kind: "paragraph", text: "D" },
      { label: "Key points", kind: "bullets", items: ["k"] },
    ]);
  });
});

describe("forFormat", () => {
  const skill = (id: string, formats?: string[]) => ({
    id,
    name: id,
    whenToUse: "",
    instructions: "",
    surfaces: [],
    formats,
    enabled: true,
  });
  const snapshot = {
    project: null,
    pillars: [],
    blocks: [],
    skills: [
      skill("all"),
      skill("legacy", undefined),
      skill("article", ["article"]),
      skill("long", ["long"]),
    ],
  } as unknown as BrainSnapshot;

  it("keeps all-format skills and the matching format's", () => {
    expect(forFormat(snapshot, "article").skills.map((s) => s.id)).toEqual([
      "all",
      "legacy",
      "article",
    ]);
    expect(forFormat(snapshot, undefined)).toBe(snapshot);
  });
});
