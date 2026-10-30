import { expect, it } from "vitest";
import { readSection, splitContext } from "./sections";

const captions = Array.from({ length: 200 }, (_, i) => ({
  id: `C${i}`,
  kind: "caption",
  start: i,
  end: i + 1,
  text: `caption number ${i} with some words`,
}));
const context = {
  playhead: 12,
  selectedCaptionIDs: ["c5"],
  captionStyle: { fontSize: 40 },
  timelineItems: captions,
};

it("inlines small sections, withholds large ones and surfaces the selected items", () => {
  const { overview, withheld } = splitContext(context, 1000);
  expect(overview.playhead).toBe(12);
  expect(overview.captionStyle).toEqual({ fontSize: 40 });
  expect(overview.timelineItems).toBeUndefined();
  expect(withheld.timelineItems).toBe(captions);
  expect(overview.withheldSections).toEqual([
    {
      section: "timelineItems",
      items: 200,
      bytes: JSON.stringify(captions).length,
    },
  ]);
  expect(overview.selectedFromWithheld).toEqual({
    timelineItems: [captions[5]],
  });
});

it("keeps everything inline when the project fits the budget", () => {
  const { overview, withheld } = splitContext(context, 1_000_000);
  expect(withheld).toEqual({});
  expect(overview.timelineItems).toBe(captions);
  expect(overview.withheldSections).toBeUndefined();
});

it("reads a section by IDs, by timeline window, and in pages", () => {
  expect(
    readSection(context, { section: "timelineItems", ids: ["c7", "C9"] }),
  ).toMatchObject({ total: 2, items: [captions[7], captions[9]] });
  expect(
    readSection(context, { section: "timelineItems", from: 10.5, to: 12 }),
  ).toMatchObject({ total: 3, items: captions.slice(10, 13) });
  const first = readSection(context, { section: "timelineItems" }) as {
    items: unknown[];
    nextOffset?: number;
  };
  expect(first.items.length).toBeLessThan(200);
  expect(first.nextOffset).toBe(first.items.length);
  expect(readSection(context, { section: "missing" })).toEqual({
    error: "No section named missing.",
  });
});
