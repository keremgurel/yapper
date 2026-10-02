import { describe, expect, it } from "vitest";
import { diffRewrite } from "./phrase-diff";

const changed = (before: string, after: string) =>
  diffRewrite(before, after)
    .filter((token) => token.changed)
    .map((token) => token.text);

describe("marking what changed in a rewritten line", () => {
  it("marks only the new words", () => {
    expect(
      changed(
        "I think it depends of the person",
        "I think it depends on the person",
      ),
    ).toEqual(["on"]);
  });

  it("ignores case and punctuation when matching", () => {
    expect(changed("so, people stay Home", "People stay home.")).toEqual([]);
  });

  it("keeps the rewrite's own words and order", () => {
    expect(
      diffRewrite("it is more lazy", "it is the lazier option").map(
        (token) => token.text,
      ),
    ).toEqual(["it", "is", "the", "lazier", "option"]);
  });

  it("marks every word when nothing is shared", () => {
    expect(changed("um yeah", "Start with the point")).toHaveLength(4);
  });

  it("handles empty lines", () => {
    expect(diffRewrite("anything", "")).toEqual([]);
    expect(changed("", "new line")).toEqual(["new", "line"]);
  });
});
