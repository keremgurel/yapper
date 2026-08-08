import { afterEach, describe, expect, it, vi } from "vitest";
import { dailyIdeas } from "@/components/studio-home/daily-ideas";
import type { RankedVideo } from "@/components/studio-home/rank-videos";
import type { ItemSummary } from "@/lib/ideas/client";

const idea = (over: Partial<ItemSummary> = {}): ItemSummary =>
  ({
    id: "i",
    title: "",
    status: "drafted",
    stage: "bank",
    formats: [],
    ideaType: null,
    scheduledFor: null,
    submissionId: null,
    pillar: null,
    pillarId: null,
    sourceUrl: null,
    sourceTitle: null,
    sourcePlatform: null,
    transcriptStatus: null,
    script: null,
    originalNote: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as ItemSummary;

const topVideo = (title: string) => ({ title }) as RankedVideo;

afterEach(() => vi.useRealTimers());

describe("dailyIdeas", () => {
  it("always returns five prompts", () => {
    expect(dailyIdeas([])).toHaveLength(5);
    expect(
      dailyIdeas(
        Array.from({ length: 20 }, (_, i) => idea({ title: `t${i}` })),
      ),
    ).toHaveLength(5);
  });

  /** The creator's own banked ideas are worth more than anything generated,
   * so they take the top of the list and the filler only backfills what is
   * left. */
  it("leads with the creator's own saved ideas", () => {
    const out = dailyIdeas([
      idea({ title: "Mine" }),
      idea({ title: "Also mine" }),
    ]);
    expect(out.slice(0, 2)).toEqual(["Mine", "Also mine"]);
  });

  it("suggests a follow-up to the top performer when there is one", () => {
    const out = dailyIdeas([], topVideo("How I passed"));
    expect(out.some((line) => line.includes("How I passed"))).toBe(true);
  });

  it("omits the follow-up when no video has a title", () => {
    const out = dailyIdeas([], { title: "" } as RankedVideo);
    expect(out.some((line) => line.includes("follow-up"))).toBe(false);
  });

  /** Rotating on the calendar day is what lets the list feel new each morning
   * without storing anything per user. If two days produced the same five
   * lines the whole mechanism would be pointless. */
  it("rotates the evergreen starters day to day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 9));
    const monday = dailyIdeas([]);
    vi.setSystemTime(new Date(2026, 2, 2, 9));
    expect(dailyIdeas([])).not.toEqual(monday);
  });

  /**
   * The turnover is the creator's local midnight, not UTC's, which is why the
   * day index is built from the local getters. These dates are constructed in
   * local time on purpose: written as UTC instants they would straddle two
   * local days in most of the Americas and this would fail for the right
   * reason in the wrong place.
   */
  it("gives the same list all day, turning over at local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 0, 1));
    const justAfterMidnight = dailyIdeas([]);
    vi.setSystemTime(new Date(2026, 2, 1, 23, 59));
    expect(dailyIdeas([])).toEqual(justAfterMidnight);

    vi.setSystemTime(new Date(2026, 2, 2, 0, 1));
    expect(dailyIdeas([])).not.toEqual(justAfterMidnight);
  });

  it("never repeats a line", () => {
    const out = dailyIdeas([idea({ title: "Dupe" }), idea({ title: "Dupe" })]);
    expect(new Set(out).size).toBe(out.length);
  });
});
