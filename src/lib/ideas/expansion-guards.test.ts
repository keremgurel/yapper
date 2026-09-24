import { describe, expect, it } from "vitest";
import {
  dropRestatedOpener,
  guardExpansion,
  matchPillar,
} from "./expansion-guards";

describe("matchPillar", () => {
  const pillars = ["Educational", "Storytelling", "Behind the scenes"];

  it("files a sentence-long near duplicate under the existing pillar", () => {
    expect(
      matchPillar("Educational videos showing how to market an app", pillars),
    ).toBe("Educational");
  });

  it("matches across word forms", () => {
    expect(matchPillar("Education", pillars)).toBe("Educational");
    expect(matchPillar("storytelling", pillars)).toBe("Storytelling");
  });

  it("keeps a genuinely new pillar, shortened to a label", () => {
    expect(matchPillar("Product launch breakdowns for founders", pillars)).toBe(
      "Product launch breakdowns",
    );
  });

  it("passes null through", () => {
    expect(matchPillar(null, pillars)).toBeNull();
  });
});

describe("dropRestatedOpener", () => {
  const hooks = [
    "If you are stuck marketing to your first customers, steal this instead of reading another growth thread.",
  ];

  it("drops a script opener that restates the hook", () => {
    const script =
      "If you are trying to get your first customers and your marketing sounds logical but dead, this is for you.\n\nThe person I keep going back to is Rory Sutherland.";
    expect(dropRestatedOpener(script, hooks)).toBe(
      "The person I keep going back to is Rory Sutherland.",
    );
  });

  it("keeps a script that already continues from the hook", () => {
    const script =
      "Rory Sutherland ran the campaigns behind Amex, Uber and Tesla. Here is what he would ask you.";
    expect(dropRestatedOpener(script, hooks)).toBe(script);
  });

  it("never empties a one-sentence script", () => {
    const script =
      "If you are stuck marketing to your first customers, read on.";
    expect(dropRestatedOpener(script, hooks)).toBe(script);
  });
});

describe("guardExpansion", () => {
  it("applies both guards", () => {
    const out = guardExpansion(
      {
        title: "Rory prompt",
        pillar: "Educational videos showing",
        hooks: ["If you are stuck marketing, steal this."],
        script: "If you are stuck with marketing, this is for you. Next beat.",
        sections: [],
      },
      ["Educational"],
    );
    expect(out.pillar).toBe("Educational");
    expect(out.script).toBe("Next beat.");
  });
});
