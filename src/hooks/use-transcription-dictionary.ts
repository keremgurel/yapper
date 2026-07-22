"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  cleanDictionaryAliases,
  cleanDictionaryValue,
  dictionaryKey,
  MAX_DICTIONARY_ENTRIES,
  type TranscriptionDictionaryEntry,
} from "@/lib/studio/transcription-dictionary";

const STORAGE_KEY = "yapper:transcription-dictionary:v1";

function readLocalEntries(): TranscriptionDictionaryEntry[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is TranscriptionDictionaryEntry =>
        Boolean(
          entry &&
          typeof entry === "object" &&
          "id" in entry &&
          typeof entry.id === "string" &&
          "term" in entry &&
          typeof entry.term === "string" &&
          "aliases" in entry &&
          Array.isArray(entry.aliases),
        ),
      )
      .slice(0, MAX_DICTIONARY_ENTRIES);
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: TranscriptionDictionaryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function localEntry(
  term: string,
  aliases: string[],
): TranscriptionDictionaryEntry {
  return {
    id: `local-${crypto.randomUUID()}`,
    term: cleanDictionaryValue(term),
    aliases: cleanDictionaryAliases(aliases),
  };
}

async function postEntry(term: string, aliases: string[]) {
  const res = await fetch("/api/transcription-dictionary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term, aliases }),
  });
  if (!res.ok) throw new Error(`dictionary_create_${res.status}`);
  return ((await res.json()) as { entry: TranscriptionDictionaryEntry }).entry;
}

/** Personal ASR vocabulary: local-first in the free editor, DB-synced on login. */
export function useTranscriptionDictionary() {
  const { isLoaded, isSignedIn } = useUser();
  const [entries, setEntries] = useState<TranscriptionDictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const local = readLocalEntries();

    const load = async () => {
      if (!isSignedIn) {
        if (!cancelled) {
          setEntries(local);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/transcription-dictionary");
        if (!res.ok) throw new Error(`dictionary_load_${res.status}`);
        const remote = (
          (await res.json()) as { entries: TranscriptionDictionaryEntry[] }
        ).entries;
        const remoteKeys = new Set(
          remote.map((entry) => dictionaryKey(entry.term)),
        );
        const missing = local.filter(
          (entry) => !remoteKeys.has(dictionaryKey(entry.term)),
        );
        const synced = await Promise.all(
          missing.map((entry) => postEntry(entry.term, entry.aliases)),
        );
        const next = [...synced, ...remote].slice(0, MAX_DICTIONARY_ENTRIES);
        if (!cancelled) {
          setEntries(next);
        }
      } catch (cause) {
        console.error("[dictionary] load failed", cause);
        if (!cancelled) {
          setEntries(local);
          setError("Couldn’t sync your dictionary. Local terms still work.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!loading) writeLocalEntries(entries);
  }, [entries, loading]);

  const addEntry = useCallback(
    async (term: string, aliases: string[] = []) => {
      const cleanTerm = cleanDictionaryValue(term);
      if (!dictionaryKey(cleanTerm)) throw new Error("bad_term");
      setError(null);

      try {
        const entry = isSignedIn
          ? await postEntry(cleanTerm, aliases)
          : localEntry(cleanTerm, aliases);
        setEntries((current) => {
          const next = [
            entry,
            ...current.filter(
              (item) => dictionaryKey(item.term) !== dictionaryKey(entry.term),
            ),
          ].slice(0, MAX_DICTIONARY_ENTRIES);
          return next;
        });
        return entry;
      } catch (cause) {
        console.error("[dictionary] add failed", cause);
        const fallback = localEntry(cleanTerm, aliases);
        setEntries((current) => {
          const next = [fallback, ...current].slice(0, MAX_DICTIONARY_ENTRIES);
          return next;
        });
        setError("Saved on this device; cloud sync will retry next time.");
        return fallback;
      }
    },
    [isSignedIn],
  );

  const updateEntry = useCallback(
    async (id: string, term: string, aliases: string[]) => {
      const cleanTerm = cleanDictionaryValue(term);
      const cleanAliases = cleanDictionaryAliases(aliases).filter(
        (alias) => dictionaryKey(alias) !== dictionaryKey(cleanTerm),
      );
      if (!dictionaryKey(cleanTerm)) throw new Error("bad_term");
      setError(null);

      let entry: TranscriptionDictionaryEntry;
      if (isSignedIn && !id.startsWith("local-")) {
        const res = await fetch(`/api/transcription-dictionary/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term: cleanTerm, aliases: cleanAliases }),
        });
        if (!res.ok) throw new Error(`dictionary_update_${res.status}`);
        entry = ((await res.json()) as { entry: TranscriptionDictionaryEntry })
          .entry;
      } else if (isSignedIn) {
        entry = await postEntry(cleanTerm, cleanAliases);
      } else {
        entry = { id, term: cleanTerm, aliases: cleanAliases };
      }

      setEntries((current) => {
        const next = current.map((item) => (item.id === id ? entry : item));
        return next;
      });
      return entry;
    },
    [isSignedIn],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setError(null);
      if (isSignedIn && !id.startsWith("local-")) {
        const res = await fetch(`/api/transcription-dictionary/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`dictionary_delete_${res.status}`);
      }
      setEntries((current) => {
        const next = current.filter((entry) => entry.id !== id);
        return next;
      });
    },
    [isSignedIn],
  );

  const rememberCorrection = useCallback(
    async (heard: string, term: string) => {
      const existing = entries.find(
        (entry) => dictionaryKey(entry.term) === dictionaryKey(term),
      );
      if (!existing) return addEntry(term, [heard]);
      const aliases = cleanDictionaryAliases([...existing.aliases, heard]);
      return updateEntry(existing.id, existing.term, aliases);
    },
    [entries, addEntry, updateEntry],
  );

  return {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    removeEntry,
    rememberCorrection,
    clearError: () => setError(null),
  };
}
