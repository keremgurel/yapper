import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { importContentItems, type ImportItem } from "@/lib/db/content";
import { ensureUser } from "@/lib/db/users";
import { IMPORT_MAX, parseContentInput } from "@/lib/content/input";

export const runtime = "nodejs";

const ms = (v: unknown): Date | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v);
  // Sanity window: reject nonsense timestamps, keep real ones.
  return d.getFullYear() >= 2020 && d.getTime() <= Date.now() ? d : undefined;
};

/**
 * One-time import of the client's localStorage ideas into the Content Library.
 * Fully retryable: the whole batch inserts in one statement and conflicts on
 * (userId, sourceClientId) are skipped, so a retried or duplicated import can
 * never create duplicates. Items land as `drafted`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = (await req.json().catch(() => ({}))) as {
    items?: unknown;
  };
  if (!Array.isArray(body.items)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.items.length > IMPORT_MAX) {
    return Response.json({ error: "too_many_items" }, { status: 400 });
  }

  const items: ImportItem[] = [];
  for (const raw of body.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id !== "string" || !rec.id.trim()) continue;
    const { input } = parseContentInput(rec);
    // Imports are always drafts; ignore any client-claimed status.
    delete input.status;
    items.push({
      ...input,
      sourceClientId: rec.id.slice(0, 100),
      createdAt: ms(rec.createdAt),
      updatedAt: ms(rec.updatedAt),
    });
  }

  const imported = await importContentItems(userId, items);
  return Response.json({ imported, received: items.length });
}
