import { describe, expect, it } from "vitest";
import { expansionToPatch, sourceToPatch } from "@/lib/ideas/expansion-patch";
import type { IdeaExpansion } from "@/lib/ideas/types";

function expansion(fields: Partial<IdeaExpansion> = {}): IdeaExpansion {
  return { title: "A title", pillar: null, ...fields };
}

describe("expansionToPatch", () => {
  it("keeps reference-specific sections instead of flattening them", () => {
    const patch = expansionToPatch(
      expansion({
        format: "Audio-led reaction sketch",
        summary: "The audio carries the joke.",
        sections: [
          { label: "Joke mechanics", kind: "bullets", items: ["a", "b"] },
          { label: "Beat-by-beat", kind: "steps", items: ["one", "two"] },
          { label: "Draft", kind: "script", text: "Say this." },
        ],
      }),
    );

    // The old curate.ts collapsed all of this into points/example/cta.
    expect(patch.blocks).toEqual([
      { label: "Joke mechanics", kind: "bullets", items: ["a", "b"] },
      { label: "Beat-by-beat", kind: "steps", items: ["one", "two"] },
      { label: "Draft", kind: "script", text: "Say this." },
    ]);
    expect(patch.format).toBe("Audio-led reaction sketch");
    expect(patch.summary).toBe("The audio carries the joke.");
  });

  it("lifts the script out of a script section", () => {
    const patch = expansionToPatch(
      expansion({
        sections: [{ label: "Draft", kind: "script", text: "The words." }],
      }),
    );
    expect(patch.script).toBe("The words.");
  });

  it("prefers an explicit script over a script section", () => {
    const patch = expansionToPatch(
      expansion({
        script: "Explicit.",
        sections: [{ label: "Draft", kind: "script", text: "Section." }],
      }),
    );
    expect(patch.script).toBe("Explicit.");
  });

  it("converts a legacy fixed-template expansion into blocks", () => {
    const patch = expansionToPatch(
      expansion({
        keyPoints: ["Fillers signal doubt", "Pause instead"],
        outline: ["Hook", "The cost", "CTA"],
      }),
    );
    expect(patch.blocks).toEqual([
      {
        label: "Key points",
        kind: "bullets",
        items: ["Fillers signal doubt", "Pause instead"],
      },
      { label: "Outline", kind: "steps", items: ["Hook", "The cost", "CTA"] },
    ]);
  });

  it("does not invent a hook pattern the model never chose", () => {
    const patch = expansionToPatch(expansion({ hooks: ["Stop saying um."] }));
    expect(patch.hooks).toEqual([
      { text: "Stop saying um.", pattern: null, why: null },
    ]);
  });

  it("drops sections with no content at all", () => {
    const patch = expansionToPatch(
      expansion({
        sections: [
          { label: "Empty", kind: "bullets", items: [] },
          { label: "Real", kind: "paragraph", text: "Keep." },
        ],
      }),
    );
    expect(patch.blocks).toEqual([
      { label: "Real", kind: "paragraph", text: "Keep." },
    ]);
  });
});

describe("sourceToPatch", () => {
  it("stores the verbatim transcript and marks it ready", () => {
    const patch = sourceToPatch({
      url: "https://insta/reel/1",
      title: "A reel",
      transcript: "The exact words spoken.",
      platform: "instagram",
    });
    expect(patch.sourceTranscript).toBe("The exact words spoken.");
    expect(patch.transcriptStatus).toBe("ready");
  });

  it("reports needs_media when nothing could be heard or read", () => {
    const patch = sourceToPatch({ url: "https://insta/reel/2" });
    expect(patch.transcriptStatus).toBe("needs_media");
  });

  it("marks a summary-only reference unavailable rather than pretending", () => {
    const patch = sourceToPatch({
      url: "https://example.com/article",
      summary: "A faithful summary of the article.",
      referenceType: "article",
    });
    // Honest: we have something, but it is not the reference's spoken words.
    expect(patch.transcriptStatus).toBe("unavailable");
    expect(patch.sourceTranscript).toBeNull();
  });
});
