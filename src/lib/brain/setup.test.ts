import { describe, expect, it } from "vitest";
import { ESSENTIAL_FIELD_CAPS } from "./context/field-caps";
import { parseSetupProposal } from "./setup";

describe("Brain setup proposal parsing", () => {
  it("keeps only the fields the document covered and bounds every list", () => {
    const proposal = parseSetupProposal(
      JSON.stringify({
        essentials: {
          name: "  Kerem  ",
          audience: "People who spot a gap in themselves and close it.",
          voice: "",
          extra: "ignored",
        },
        pillars: [
          {
            name: "Brain Dumps",
            description: "Knowledge and perspective.",
            examples: ["the trap smart people fall into", "", 7],
          },
          { name: "brain dumps", description: "duplicate" },
          { name: "", description: "nameless" },
        ],
        blocks: [
          {
            title: "Audience segments",
            digest: "Who buys, who climbs, who follows.",
            body: "Primary: self-improving builders…",
            tags: ["Audience", "segments", "audience"],
            usage: "private",
          },
          { title: "No body", body: "" },
        ],
        notes: "Nothing on offers.",
      }),
    );
    expect(proposal.essentials).toEqual({
      name: "Kerem",
      audience: "People who spot a gap in themselves and close it.",
    });
    expect(proposal.pillars).toEqual([
      {
        name: "Brain Dumps",
        description: "Knowledge and perspective.",
        examples: ["the trap smart people fall into"],
      },
    ]);
    expect(proposal.blocks).toEqual([
      {
        title: "Audience segments",
        digest: "Who buys, who climbs, who follows.",
        body: "Primary: self-improving builders…",
        tags: ["audience", "segments"],
        usage: "auto",
      },
    ]);
    expect(proposal.notes).toBe("Nothing on offers.");
  });

  it("fits every essential under what the AI reads, whole sentences only", () => {
    const sentence = "I build tools for people who close their own gaps. ";
    const proposal = parseSetupProposal(
      JSON.stringify({
        essentials: { offers: sentence.repeat(8) },
        blocks: [{ title: "Why", body: "Because.", usage: "core" }],
      }),
    );
    const offers = proposal.essentials.offers ?? "";
    expect(offers.length).toBeLessThanOrEqual(ESSENTIAL_FIELD_CAPS.offers);
    expect(offers.endsWith(".")).toBe(true);
    // Setup never promotes a section to always-on.
    expect(proposal.blocks[0].usage).toBe("auto");
  });

  it("treats an empty or unparseable reply as a failure", () => {
    expect(() => parseSetupProposal("no json here")).toThrow(
      "setup_unparseable",
    );
    expect(() =>
      parseSetupProposal('{"essentials":{},"pillars":[],"blocks":[]}'),
    ).toThrow("setup_empty");
  });
});
