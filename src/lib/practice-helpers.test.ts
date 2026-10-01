import { describe, expect, it } from "vitest";
import topics, { CATEGORIES, DIFFICULTIES } from "@/data/topics";
import { trainingModes } from "@/data/training-modes";
import {
  clampTimerSeconds,
  filterTopicPool,
  getRandomFromPool,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
} from "./practice-helpers";

describe("training mode configuration", () => {
  it("gives each mode a unique route and a supported default duration", () => {
    expect(new Set(trainingModes.map((mode) => mode.slug)).size).toBe(
      trainingModes.length,
    );
    for (const mode of trainingModes) {
      expect(mode.seconds).toBeGreaterThanOrEqual(TIMER_MIN_SECONDS);
      expect(mode.seconds).toBeLessThanOrEqual(TIMER_MAX_SECONDS);
      if (!["topic", "freestyle"].includes(mode.kind))
        expect(mode.pool?.length).toBeGreaterThan(0);
    }
  });
  it("keeps filtered scenario prompts in their original exercise", () => {
    for (const mode of trainingModes.filter((mode) => mode.pool)) {
      for (const difficulty of DIFFICULTIES) {
        const filtered = filterTopicPool(mode.pool!, "All", difficulty);
        if (!filtered.length) continue;
        const selected = getRandomFromPool(filtered, null);
        expect(selected.difficulty).toBe(difficulty);
        expect(mode.pool).toContain(selected);
      }
    }
  });
  it("supports each category and only exposes levels with matching prompts", () => {
    for (const category of CATEGORIES) {
      const categoryPool = filterTopicPool(topics, category, "All");
      expect(categoryPool.length).toBeGreaterThan(0);
      for (const difficulty of DIFFICULTIES) {
        const filtered = filterTopicPool(topics, category, difficulty);
        expect(
          filtered.every(
            (topic) =>
              topic.category === category && topic.difficulty === difficulty,
          ),
        ).toBe(true);
      }
    }
  });
  it("avoids repeating the current prompt when another is available", () => {
    expect(getRandomFromPool(topics.slice(0, 2), topics[0])).toBe(topics[1]);
  });
  it("allows longer practice while enforcing safe timer bounds", () => {
    expect(clampTimerSeconds(120)).toBe(120);
    expect(clampTimerSeconds(600)).toBe(600);
    expect(clampTimerSeconds(0)).toBe(30);
    expect(clampTimerSeconds(601)).toBe(600);
  });
});
