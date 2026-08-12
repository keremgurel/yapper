"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import {
  browserDictionaryApi,
  createDictionaryRepository,
  resolveDictionaryOwner,
  type DictionaryOwner,
} from "@/lib/studio/transcription-dictionary-repository";
import {
  cleanDictionaryAliases,
  dictionaryKey,
} from "@/lib/studio/transcription-dictionary";

const dictionaryRepository = createDictionaryRepository({
  api: browserDictionaryApi,
  getStorage: () => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  },
  createId: () => crypto.randomUUID(),
});

/** Personal ASR vocabulary isolated by the Clerk account that owns it. */
export function useTranscriptionDictionary() {
  const { isLoaded, isSignedIn, user } = useUser();
  const owner: DictionaryOwner | null = resolveDictionaryOwner(
    isLoaded,
    isSignedIn ? user?.id : undefined,
  );

  const subscribe = useCallback(
    (listener: () => void) => dictionaryRepository.subscribe(owner, listener),
    [owner],
  );
  const getSnapshot = useCallback(
    () => dictionaryRepository.getSnapshot(owner),
    [owner],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (owner) void dictionaryRepository.load(owner);
  }, [owner]);

  const addEntry = useCallback(
    (term: string, aliases: string[] = []) =>
      dictionaryRepository.add(owner, term, aliases),
    [owner],
  );

  const updateEntry = useCallback(
    (id: string, term: string, aliases: string[]) =>
      dictionaryRepository.update(owner, id, term, aliases),
    [owner],
  );

  const removeEntry = useCallback(
    (id: string) => dictionaryRepository.remove(owner, id),
    [owner],
  );

  const rememberCorrection = useCallback(
    async (heard: string, term: string) => {
      const existing = snapshot.entries.find(
        (entry) => dictionaryKey(entry.term) === dictionaryKey(term),
      );
      if (!existing) return addEntry(term, [heard]);
      const aliases = cleanDictionaryAliases([...existing.aliases, heard]);
      return updateEntry(existing.id, existing.term, aliases);
    },
    [snapshot.entries, addEntry, updateEntry],
  );

  return {
    entries: snapshot.entries,
    loading: snapshot.loading,
    error: snapshot.error,
    addEntry,
    updateEntry,
    removeEntry,
    rememberCorrection,
    clearError: () => dictionaryRepository.clearError(owner),
  };
}
