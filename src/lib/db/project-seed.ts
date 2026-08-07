import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./client";
import { ensurePillars, listPillars } from "./project-pillars";
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
 * Fill a brand-new project's pillar list, once. Runs only while the project has
 * no pillars at all, so it can never fight a creator who has since curated
 * their own list (deleting a pillar must stay deleted).
 *
 * Onboarding pillars come first because the creator typed them deliberately;
 * pillars inferred from already-classified content are appended after.
 */
export async function seedPillarsIfEmpty(
  userId: string,
  projectId: string,
  onboardingPillars: string[] = [],
): Promise<void> {
  const existing = await listPillars(projectId);
  if (existing.length) return;

  const legacy = await legacyPillarNames(userId);
  const seed = [...onboardingPillars, ...legacy]
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (!seed.length) return;

  await ensurePillars(projectId, seed);
}
