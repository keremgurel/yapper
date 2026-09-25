import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./client";
import { ensurePillars, listPillars, type PillarRow } from "./project-pillars";
import { contentItems } from "./schema";

/**
 * Every distinct free-text pillar the user has already classified content
 * under. These predate the `project_pillars` table and are the only record of
 * how the creator actually buckets their work, so they seed the real pillars
 * rather than being discarded.
 */
export async function legacyPillarNames(userId: string): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ pillar: contentItems.pillar })
    .from(contentItems)
    .where(
      and(eq(contentItems.userId, userId), isNotNull(contentItems.pillar)),
    );
  return rows
    .map((r) => r.pillar?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Projects this instance already tried to seed and found nothing to seed with.
 * Without it, a creator with no pillars would pay the onboarding lookup (a
 * Clerk Backend API call) on every read. Bounded like the other per-instance
 * caches; forgetting an entry only costs one more lookup.
 */
const MAX_BARREN = 5_000;
const barrenProjects = new Set<string>();

/**
 * The project's pillars, filling a brand-new project's list first. Seeding runs
 * only while the project has no pillars at all, so it can never fight a creator
 * who has since curated their own list (deleting a pillar must stay deleted).
 *
 * Onboarding pillars come first because the creator typed them deliberately;
 * pillars inferred from already-classified content are appended after. They
 * are loaded lazily because reading them is a network call, and a project that
 * already has pillars never needs them.
 */
export async function listPillarsSeeded(
  userId: string,
  projectId: string,
  loadOnboardingPillars: () => Promise<string[]>,
): Promise<PillarRow[]> {
  const existing = await listPillars(projectId);
  if (existing.length || barrenProjects.has(projectId)) return existing;

  const [onboarding, legacy] = await Promise.all([
    loadOnboardingPillars(),
    legacyPillarNames(userId),
  ]);
  const seed = [...onboarding, ...legacy]
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (!seed.length) {
    if (barrenProjects.size >= MAX_BARREN) barrenProjects.clear();
    barrenProjects.add(projectId);
    return existing;
  }

  await ensurePillars(projectId, seed);
  return listPillars(projectId);
}
