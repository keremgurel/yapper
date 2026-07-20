import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  listDictionaryEntries,
  upsertDictionaryEntry,
} from "@/lib/db/transcription-dictionary";
import { ensureUser } from "@/lib/db/users";
import {
  cleanDictionaryAliases,
  cleanDictionaryValue,
  dictionaryKey,
  MAX_DICTIONARY_ENTRIES,
} from "@/lib/studio/transcription-dictionary";

export const runtime = "nodejs";

function parseInput(body: Record<string, unknown>) {
  const term = cleanDictionaryValue(
    typeof body.term === "string" ? body.term : "",
  );
  const aliases = cleanDictionaryAliases(
    Array.isArray(body.aliases)
      ? body.aliases.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  );
  return { term, aliases };
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const entries = await listDictionaryEntries(userId);
  return Response.json({ entries });
}

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseInput(body);
  if (!dictionaryKey(input.term)) {
    return Response.json({ error: "bad_term" }, { status: 400 });
  }

  await ensureUser(userId);
  const existing = await listDictionaryEntries(userId);
  const alreadyExists = existing.some(
    (entry) => dictionaryKey(entry.term) === dictionaryKey(input.term),
  );
  if (!alreadyExists && existing.length >= MAX_DICTIONARY_ENTRIES) {
    return Response.json({ error: "dictionary_full" }, { status: 400 });
  }

  const entry = await upsertDictionaryEntry(userId, input);
  return Response.json({ entry }, { status: alreadyExists ? 200 : 201 });
}
