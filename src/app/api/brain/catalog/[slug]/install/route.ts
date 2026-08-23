import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { createBrainBlock } from "@/lib/db/project-brain";
import { installCatalogSkill } from "@/lib/db/project-skills";
import { getPublishedCatalogEntry } from "@/lib/db/skill-catalog";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

/**
 * Take a copy.
 *
 * A skill entry becomes a skill the creator owns and can rewrite. A context
 * entry becomes an ordinary section, pre-filled with the prompts it asks, which
 * is the difference between handing someone a worksheet and handing them a
 * blank page titled "worksheet".
 *
 * Installing twice is not an error. For a skill it refreshes the copy, which is
 * exactly what the update button does; for a section it appends another one,
 * because two copies of a worksheet is a thing a person might actually want.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;

  const entry = await getPublishedCatalogEntry(slug);
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  if (entry.kind === "context") {
    const block = await createBrainBlock(project.id, {
      title: entry.name,
      kind: "note",
      body: entry.instructions,
      digest: entry.tagline,
      // Never on by default. The creator has just been handed a set of
      // questions, and the answers are not in it yet; a prompt reading the
      // unanswered worksheet would write from the questions.
      usage: "manual",
      sourceLabel: "From the catalog",
    });
    invalidateBrainContext(project.id);
    return Response.json({ block }, { status: 201 });
  }

  const skill = await installCatalogSkill(project.id, {
    slug: entry.slug,
    version: entry.version,
    name: entry.name,
    whenToUse: entry.whenToUse,
    instructions: entry.instructions,
    surfaces: entry.surfaces,
  });
  invalidateBrainContext(project.id);
  return Response.json({ skill }, { status: 201 });
}
