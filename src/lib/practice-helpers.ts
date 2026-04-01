import topics, {
  type Topic,
  type Category,
  type Difficulty,
} from "@/data/topics";

export const TIMER_MIN_SECONDS = 30;
export const TIMER_MAX_SECONDS = 90;

export function getRandomTopic(
  exclude: Topic | null,
  category: Category | "All",
  difficulty: Difficulty | "All",
): Topic {
  let pool = topics;
  if (category !== "All") pool = pool.filter((t) => t.category === category);
  if (difficulty !== "All") {
    pool = pool.filter((t) => t.difficulty === difficulty);
  }
  if (pool.length === 0) pool = topics;

  let nextTopic: Topic;
  do {
    nextTopic = pool[Math.floor(Math.random() * pool.length)];
  } while (nextTopic === exclude && pool.length > 1);

  return nextTopic;
}

export function pickReelBlurbs(): string[] {
  return Array.from(
    { length: 5 },
    () => topics[Math.floor(Math.random() * topics.length)].text,
  );
}

export function clampTimerSeconds(value: number): number {
  return Math.min(
    TIMER_MAX_SECONDS,
    Math.max(TIMER_MIN_SECONDS, Math.round(value)),
  );
}

export function formatSecondsDisplay(seconds: number): string {
  return `${Math.max(0, Math.floor(seconds))}s`;
}
