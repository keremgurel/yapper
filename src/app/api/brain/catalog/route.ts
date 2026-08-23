import { auth } from "@clerk/nextjs/server";
import { listPublishedCatalog } from "@/lib/db/skill-catalog";
import { listProjectSkills } from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

/**
 * The shelf, with the creator's own copies already accounted for.
 *
 * `installedVersion` is what turns a browse list into a useful one: an entry
 * the creator already has says so instead of offering itself again, and one
 * whose catalog version has moved on can offer the update. Computing it here
 * rather than in the browser means the page cannot show "install" for something
 * that is already running.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const [entries, installed] = await Promise.all([
    listPublishedCatalog(),
    listProjectSkills(project.id),
  ]);

  const bySlug = new Map(
    installed
      .filter((skill) => skill.catalogSlug)
      .map((skill) => [skill.catalogSlug as string, skill]),
  );

  return Response.json({
    entries: entries.map((entry) => {
      const copy = bySlug.get(entry.slug);
      return {
        slug: entry.slug,
        version: entry.version,
        kind: entry.kind,
        name: entry.name,
        tagline: entry.tagline,
        whenToUse: entry.whenToUse,
        instructions: entry.instructions,
        surfaces: entry.surfaces,
        category: entry.category,
        installedVersion: copy?.catalogVersion ?? null,
        customized: copy?.customized ?? false,
      };
    }),
  });
}
