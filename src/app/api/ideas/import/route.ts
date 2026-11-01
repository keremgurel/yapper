import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { IMPORT_MAX } from "@/lib/content/input";
import { refusalResponse } from "@/lib/http/operation-result";
import {
  importReferences,
  type ReferenceLink,
} from "@/lib/ideas/operations/import-references";

export const runtime = "nodejs";

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

const ms = (v: unknown): Date | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v);
  return d.getFullYear() >= 2005 && d.getTime() <= Date.now() ? d : undefined;
};

/** Bulk-import saved references (an Instagram saves archive) into the Idea
 * Bank, deduplicated by importReferences, which Chirpy shares. */
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

  const links: ReferenceLink[] = [];
  for (const raw of body.entries) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const url = str(rec.url, 600);
    if (url)
      links.push({ url, title: str(rec.title, 300), savedAt: ms(rec.savedAt) });
  }

  const result = await importReferences(userId, links);
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}
