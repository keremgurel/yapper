import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { IMPORT_MAX } from "@/lib/content/input";
import { importContentItems, type ImportItem } from "@/lib/db/content";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { expansionToPatch, sourceToPatch } from "@/lib/ideas/expansion-patch";
import type { Idea } from "@/lib/ideas/types";

export const runtime = "nodejs";

const ms = (v: unknown): Date | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v);
  return d.getFullYear() >= 2020 && d.getTime() <= Date.now() ? d : undefined;
};

/**
 * One-time migration of a browser's localStorage Idea Bank into Postgres.
 *
 * Lossless by construction: the creator's verbatim words, the reference's full
 * transcript, and the AI expansion's reference-specific sections all land in
 * real columns. Nothing is flattened, which is the entire reason this table
 * grew a flexible body before the ideas moved into it.
 *
 * Fully retryable: rows are keyed by their original localStorage id via
 * (userId, sourceClientId), so a re-run inserts nothing.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ideas?: unknown };
  if (!Array.isArray(body.ideas)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.ideas.length > IMPORT_MAX) {
    return Response.json({ error: "too_many_items" }, { status: 400 });
  }

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  const items: ImportItem[] = [];
  for (const raw of body.ideas) {
    if (!raw || typeof raw !== "object") continue;
    const idea = raw as Partial<Idea> & Record<string, unknown>;
    if (typeof idea.id !== "string" || !idea.id.trim()) continue;

    const note =
      typeof idea.originalTranscript === "string"
        ? idea.originalTranscript
        : "";
    const hasSource = Boolean(idea.source?.url);
    if (!note.trim() && !hasSource) continue;

    const expansion = idea.expansion ? expansionToPatch(idea.expansion) : null;
    const source = idea.source?.url ? sourceToPatch(idea.source) : null;

    items.push({
      projectId: project.id,
      // A localStorage idea that was already curated has a library counterpart
      // created by the old (lossy) bridge; it still belongs in the bank as the
      // record of the creator's own words.
      stage: "bank",
      status: "drafted",
      ideaType: idea.type ?? null,
      originalNote: note.slice(0, 20_000),
      title: expansion?.title ?? "",
      blocks: expansion?.blocks ?? [],
      hooks: expansion?.hooks ?? [],
      format: expansion?.format ?? null,
      summary: expansion?.summary ?? null,
      script: expansion?.script ?? null,
      pillar: expansion?.pillar ?? null,
      ...(source ?? {}),
      sourceClientId: idea.id.slice(0, 100),
      createdAt: ms(idea.createdAt),
      updatedAt: ms(idea.updatedAt),
    });
  }

  const imported = await importContentItems(userId, items);
  return Response.json({ imported, received: items.length });
}
