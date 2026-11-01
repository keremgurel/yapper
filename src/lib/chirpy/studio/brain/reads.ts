import { count, desc, eq } from "drizzle-orm";
import { readBrainSnapshot } from "@/lib/brain/context/server";
import { getDb } from "@/lib/db/client";
import { listConnections } from "@/lib/db/publish";
import { voiceSamples } from "@/lib/db/schema";
import { listPublishedCatalog } from "@/lib/db/skill-catalog";
import { buildBrainOverview, type BrainOverview } from "./overview";

/** Requests on other tabs that are about the Brain. Only decides whether the
 * Brain's overview is read for the turn, never what Chirpy does. */
const ABOUT_THE_BRAIN =
  /\b(brain|knowledge|essentials?|skills?|voice|audience|niche|scripting|offers?|promot\w*|never say|remember|worksheets?|catalog|sections?|what (?:do )?i make|who (?:am i|i am|my (?:videos|content) (?:is|are) for)|my (?:style|tone|bio|brand voice))\b/i;
const ABOUT_THE_CATALOG =
  /\b(catalog|install\w*|worksheets?|templates?|reset|default|starter|skills?)\b/i;
const SAMPLE_LINES = 4;

/** Whether a turn reads the Brain: always on the Brain tab, elsewhere only
 * when the request is about it. */
export function needsBrain(surface: string, request: string): boolean {
  return surface.startsWith("/studio/brain") || ABOUT_THE_BRAIN.test(request);
}

/**
 * The Brain as the planner sees it, read from the same cached snapshot the
 * prompts use plus the voice set and the connected platforms. The catalog is
 * read only when the request is about skills or the catalog.
 */
export async function readBrainOverview(
  userId: string,
  request: string,
): Promise<BrainOverview> {
  const { project, snapshot } = await readBrainSnapshot(userId);
  const [samples, [{ total } = { total: 0 }], connections, catalog] =
    await Promise.all([
      getDb()
        .select({
          id: voiceSamples.id,
          title: voiceSamples.title,
          platform: voiceSamples.platform,
        })
        .from(voiceSamples)
        .where(eq(voiceSamples.projectId, project.id))
        .orderBy(desc(voiceSamples.createdAt))
        .limit(SAMPLE_LINES),
      getDb()
        .select({ total: count() })
        .from(voiceSamples)
        .where(eq(voiceSamples.projectId, project.id)),
      listConnections(userId),
      ABOUT_THE_CATALOG.test(request) ? listPublishedCatalog() : null,
    ]);
  return buildBrainOverview(
    {
      project: project as unknown as Record<string, unknown>,
      snapshot,
      samples: samples.map((sample) => ({
        ...sample,
        title: sample.title || "Untitled video",
      })),
      sampleCount: total,
      connected: connections
        .filter(
          (connection) =>
            connection.status === "active" &&
            connection.platform !== "facebook",
        )
        .map((connection) => connection.platform),
      ...(catalog
        ? {
            catalog: catalog.map((entry) => ({
              slug: entry.slug,
              name: entry.name,
              kind: entry.kind,
            })),
          }
        : {}),
    },
    request,
  );
}
