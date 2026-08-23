import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isAdmin, notFound } from "@/lib/auth/admin";
import { parseCatalogInput } from "@/lib/brain/skill-input";
import { deleteCatalogEntry, updateCatalogEntry } from "@/lib/db/skill-catalog";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Edit an entry. Changing its text bumps the version, which is what offers the
 * update to every brain already running a copy. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return notFound();
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseCatalogInput(body);
  if (!Object.keys(input).length) {
    return Response.json({ error: "no_fields" }, { status: 400 });
  }

  const entry = await updateCatalogEntry(id, input);
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ entry });
}

/**
 * Remove an entry from the shelf.
 *
 * Copies already installed are untouched, by design: install takes a copy, so
 * pulling an entry stops it being offered rather than reaching into brains that
 * are already using it.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return notFound();
  const { id } = await params;

  const removed = await deleteCatalogEntry(id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
