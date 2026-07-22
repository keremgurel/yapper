import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  deleteDictionaryEntry,
  updateDictionaryEntry,
} from "@/lib/db/transcription-dictionary";
import {
  cleanDictionaryAliases,
  cleanDictionaryValue,
  dictionaryKey,
} from "@/lib/studio/transcription-dictionary";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const term = cleanDictionaryValue(
    typeof body.term === "string" ? body.term : "",
  );
  if (!dictionaryKey(term)) {
    return Response.json({ error: "bad_term" }, { status: 400 });
  }
  const aliases = cleanDictionaryAliases(
    Array.isArray(body.aliases)
      ? body.aliases.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  );

  try {
    const entry = await updateDictionaryEntry(userId, id, { term, aliases });
    if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ entry });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return Response.json({ error: "duplicate_term" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteDictionaryEntry(userId, id);
  if (!deleted) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
