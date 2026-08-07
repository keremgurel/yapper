import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { IMPORT_MAX } from "@/lib/content/input";
import {
  existingSourceUrls,
  importContentItems,
  type ImportItem,
} from "@/lib/db/content";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { normalizeInspoUrl } from "@/lib/inspiration/dedupe";

export const runtime = "nodejs";

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

const ms = (v: unknown): Date | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v);
  return d.getFullYear() >= 2005 && d.getTime() <= Date.now() ? d : undefined;
};

/**
 * Bulk-import saved references (an Instagram saves archive) into the Idea Bank.
 *
 * Deduplicated twice over: against what the creator already has, using the same
 * URL normalization the Inspiration library uses, and again at the database via
 * (userId, sourceClientId). A re-run of the same archive imports nothing.
 *
 * Imported entries land with `transcriptStatus: 'pending'` because their
 * references have not been resolved yet; nothing here claims to have heard them.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { entries?: unknown };
  if (!Array.isArray(body.entries)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.entries.length > IMPORT_MAX) {
    return Response.json({ error: "too_many_items" }, { status: 400 });
  }

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const seen = new Set(
    (await existingSourceUrls(userId)).map(normalizeInspoUrl),
  );

  const items: ImportItem[] = [];
  for (const raw of body.entries) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const url = str(rec.url, 600);
    if (!url) continue;

    const key = normalizeInspoUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      projectId: project.id,
      stage: "bank",
      status: "drafted",
      ideaType: "inspiration",
      sourceUrl: url,
      sourceTitle: str(rec.title, 300) ?? null,
      sourcePlatform: "instagram",
      transcriptStatus: "pending",
      // Stable per URL, so the DB unique index catches anything this pass missed.
      sourceClientId: `ig:${key}`.slice(0, 100),
      createdAt: ms(rec.savedAt),
    });
  }

  const imported = await importContentItems(userId, items);
  return Response.json({ imported, received: items.length });
}
