/**
 * The useful-on-day-one creative methods every new project owns a copy of.
 *
 * Keep these narrow and complementary. Defaults should make the first output
 * better without quietly forcing a house style onto every piece of writing.
 * The database migration uses the same slugs when it seeds existing projects.
 */
export const STARTER_SKILL_SLUGS = [
  "hook-shapes",
  "storytime-three-acts",
  "show-dont-say",
  "caption-that-earns-the-save",
] as const;

const STARTER_SKILLS = new Set<string>(STARTER_SKILL_SLUGS);

export function isStarterSkill(slug: string | null): boolean {
  return slug !== null && STARTER_SKILLS.has(slug);
}
