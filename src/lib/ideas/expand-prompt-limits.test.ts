import { describe, expect, it } from "vitest";
import { parseSections } from "@/lib/ideas/expand-prompt";

describe("parseSections input budgets", () => {
  it("inspects only the first eight candidate sections", () => {
    const sections = parseSections([
      ...Array.from({ length: 8 }, () => null),
      { label: "late", kind: "paragraph", text: "must not be parsed" },
    ]);
    expect(sections).toEqual([]);
  });

  it("caps section text and individual list items", () => {
    const [section] = parseSections([
      {
        label: "Body",
        kind: "paragraph",
        text: "x".repeat(3_000),
        items: ["y".repeat(700)],
      },
    ]);
    expect(section.text).toHaveLength(2_000);
    expect(section.items?.[0]).toHaveLength(500);
  });

  it("keeps total accepted material within twelve thousand characters", () => {
    const sections = parseSections(
      Array.from({ length: 8 }, (_, index) => ({
        label: `Block ${index}`,
        kind: "script",
        text: "x".repeat(2_000),
        items: Array.from({ length: 12 }, () => "y".repeat(500)),
      })),
    );
    const material = sections.reduce(
      (sum, section) =>
        sum +
        section.label.length +
        (section.text?.length ?? 0) +
        (section.items?.reduce((itemSum, item) => itemSum + item.length, 0) ??
          0),
      0,
    );
    expect(material).toBeLessThanOrEqual(12_000);
  });
});
