import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isVersionFormat } from "@/lib/content/formats";
import { parseVersionInput } from "@/lib/content/version-input";
import { getContentItem } from "@/lib/db/content";
import {
  deleteContentVersion,
  saveContentVersion,
} from "@/lib/db/content-versions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; format: string }> };

/**
 * Save one non-lead version of an idea (autosave and first write both land
 * here). The lead version is edited through PATCH /api/content/[id] as
 * before, so this refuses the lead's own format.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, format } = await params;
  if (!isVersionFormat(format)) {
    return Response.json({ error: "bad_format" }, { status: 400 });
  }
  const item = await getContentItem(userId, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  if (item.leadFormat === format) {
    return Response.json({ error: "lead_format" }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const version = await saveContentVersion(
    userId,
    id,
    format,
    parseVersionInput(body),
  );
  if (!version) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ version });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, format } = await params;
  if (!isVersionFormat(format)) {
    return Response.json({ error: "bad_format" }, { status: 400 });
  }
  const removed = await deleteContentVersion(userId, id, format);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
