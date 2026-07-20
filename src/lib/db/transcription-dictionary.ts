import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { transcriptionDictionary } from "@/lib/db/schema";
import {
  cleanDictionaryAliases,
  cleanDictionaryValue,
  dictionaryKey,
} from "@/lib/studio/transcription-dictionary";

export interface DictionaryInput {
  term: string;
  aliases?: string[];
}

export async function listDictionaryEntries(userId: string) {
  return getDb()
    .select({
      id: transcriptionDictionary.id,
      term: transcriptionDictionary.term,
      aliases: transcriptionDictionary.aliases,
    })
    .from(transcriptionDictionary)
    .where(eq(transcriptionDictionary.userId, userId))
    .orderBy(desc(transcriptionDictionary.updatedAt));
}

/** Add a term idempotently; repeated adds merge newly learned aliases. */
export async function upsertDictionaryEntry(
  userId: string,
  input: DictionaryInput,
) {
  const term = cleanDictionaryValue(input.term);
  const termKey = dictionaryKey(term);
  const aliases = cleanDictionaryAliases(input.aliases ?? []).filter(
    (alias) => dictionaryKey(alias) !== termKey,
  );

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(transcriptionDictionary)
      .where(
        and(
          eq(transcriptionDictionary.userId, userId),
          eq(transcriptionDictionary.termKey, termKey),
        ),
      )
      .limit(1);

    if (existing) {
      const merged = cleanDictionaryAliases([
        ...existing.aliases,
        ...aliases,
      ]).filter((alias) => dictionaryKey(alias) !== termKey);
      const [row] = await tx
        .update(transcriptionDictionary)
        .set({ term, aliases: merged, updatedAt: new Date() })
        .where(eq(transcriptionDictionary.id, existing.id))
        .returning({
          id: transcriptionDictionary.id,
          term: transcriptionDictionary.term,
          aliases: transcriptionDictionary.aliases,
        });
      return row;
    }

    const [row] = await tx
      .insert(transcriptionDictionary)
      .values({ userId, term, termKey, aliases })
      .returning({
        id: transcriptionDictionary.id,
        term: transcriptionDictionary.term,
        aliases: transcriptionDictionary.aliases,
      });
    return row;
  });
}

export async function updateDictionaryEntry(
  userId: string,
  id: string,
  input: DictionaryInput,
) {
  const term = cleanDictionaryValue(input.term);
  const termKey = dictionaryKey(term);
  const aliases = cleanDictionaryAliases(input.aliases ?? []).filter(
    (alias) => dictionaryKey(alias) !== termKey,
  );
  const [row] = await getDb()
    .update(transcriptionDictionary)
    .set({ term, termKey, aliases, updatedAt: new Date() })
    .where(
      and(
        eq(transcriptionDictionary.id, id),
        eq(transcriptionDictionary.userId, userId),
      ),
    )
    .returning({
      id: transcriptionDictionary.id,
      term: transcriptionDictionary.term,
      aliases: transcriptionDictionary.aliases,
    });
  return row ?? null;
}

export async function deleteDictionaryEntry(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(transcriptionDictionary)
    .where(
      and(
        eq(transcriptionDictionary.id, id),
        eq(transcriptionDictionary.userId, userId),
      ),
    )
    .returning({ id: transcriptionDictionary.id });
  return rows.length > 0;
}
