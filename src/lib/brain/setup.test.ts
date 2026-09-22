import { describe, expect, it } from "vitest";
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

  it("treats an empty or unparseable reply as a failure", () => {
    expect(() => parseSetupProposal("no json here")).toThrow(
      "setup_unparseable",
    );
    expect(() =>
      parseSetupProposal('{"essentials":{},"pillars":[],"blocks":[]}'),
    ).toThrow("setup_empty");
  });
});
