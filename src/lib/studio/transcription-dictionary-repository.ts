import {
  cleanDictionaryAliases,
  cleanDictionaryValue,
  dictionaryKey,
  MAX_DICTIONARY_ENTRIES,
  type TranscriptionDictionaryEntry,
} from "./transcription-dictionary";
import { DICTIONARY_OWNER_HEADER } from "./transcription-dictionary-owner";

export type DictionaryOwner = "anonymous" | `user:${string}`;

export function resolveDictionaryOwner(
  isLoaded: boolean,
  userId?: string,
): DictionaryOwner | null {
  if (!isLoaded) return null;
  return userId ? `user:${userId}` : "anonymous";
}

export interface DictionarySnapshot {
  entries: TranscriptionDictionaryEntry[];
  loading: boolean;
  error: string | null;
}

interface PersistedDictionaryV2 {
  version: 2;
  owner: DictionaryOwner;
  cached: TranscriptionDictionaryEntry[];
  pending: TranscriptionDictionaryEntry[];
}

export interface DictionaryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DictionaryApi {
  list(userId: string): Promise<TranscriptionDictionaryEntry[]>;
  create(
    userId: string,
    term: string,
    aliases: string[],
  ): Promise<TranscriptionDictionaryEntry>;
  update(
    userId: string,
    id: string,
    term: string,
    aliases: string[],
  ): Promise<TranscriptionDictionaryEntry>;
  remove(userId: string, id: string): Promise<void>;
}

interface OwnerState {
  snapshot: DictionarySnapshot;
  cached: TranscriptionDictionaryEntry[];
  pending: TranscriptionDictionaryEntry[];
  hydrated: boolean;
  loadPromise: Promise<void> | null;
  listeners: Set<() => void>;
  queue: Promise<void>;
}

const LEGACY_STORAGE_KEY = "yapper:transcription-dictionary:v1";
const EMPTY_SNAPSHOT: DictionarySnapshot = {
  entries: [],
  loading: true,
  error: null,
};

const userIdForOwner = (owner: DictionaryOwner): string | null =>
  owner.startsWith("user:") ? owner.slice("user:".length) : null;

const storageKey = (owner: DictionaryOwner) =>
  `yapper:transcription-dictionary:v2:${encodeURIComponent(owner)}`;

function isEntry(value: unknown): value is TranscriptionDictionaryEntry {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "term" in value &&
    typeof value.term === "string" &&
    "aliases" in value &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string"),
  );
}

function cleanEntries(value: unknown): TranscriptionDictionaryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: TranscriptionDictionaryEntry[] = [];
  for (const candidate of value) {
    if (!isEntry(candidate)) continue;
    const term = cleanDictionaryValue(candidate.term);
    const key = dictionaryKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: candidate.id,
      term,
      aliases: cleanDictionaryAliases(candidate.aliases).filter(
        (alias) => dictionaryKey(alias) !== key,
      ),
    });
    if (result.length >= MAX_DICTIONARY_ENTRIES) break;
  }
  return result;
}

export function parseDictionaryEnvelope(
  raw: string | null,
  expectedOwner: DictionaryOwner,
): PersistedDictionaryV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDictionaryV2>;
    if (
      parsed.version !== 2 ||
      parsed.owner !== expectedOwner ||
      !Array.isArray(parsed.cached) ||
      !Array.isArray(parsed.pending)
    ) {
      return null;
    }
    return {
      version: 2,
      owner: expectedOwner,
      cached: cleanEntries(parsed.cached),
      pending: cleanEntries(parsed.pending).filter((entry) =>
        entry.id.startsWith("local-"),
      ),
    };
  } catch {
    return null;
  }
}

function mergeEntries(
  preferred: TranscriptionDictionaryEntry[],
  fallback: TranscriptionDictionaryEntry[],
): TranscriptionDictionaryEntry[] {
  return cleanEntries([...preferred, ...fallback]);
}

function localEntry(
  createId: () => string,
  term: string,
  aliases: string[],
): TranscriptionDictionaryEntry {
  const cleanTerm = cleanDictionaryValue(term);
  return {
    id: `local-${createId()}`,
    term: cleanTerm,
    aliases: cleanDictionaryAliases(aliases).filter(
      (alias) => dictionaryKey(alias) !== dictionaryKey(cleanTerm),
    ),
  };
}

export function createDictionaryRepository({
  api,
  getStorage,
  createId,
}: {
  api: DictionaryApi;
  getStorage: () => DictionaryStorage | null;
  createId: () => string;
}) {
  const states = new Map<DictionaryOwner, OwnerState>();

  const stateFor = (owner: DictionaryOwner): OwnerState => {
    let state = states.get(owner);
    if (!state) {
      state = {
        snapshot: EMPTY_SNAPSHOT,
        cached: [],
        pending: [],
        hydrated: false,
        loadPromise: null,
        listeners: new Set(),
        queue: Promise.resolve(),
      };
      states.set(owner, state);
    }
    return state;
  };

  const publish = (
    owner: DictionaryOwner,
    patch: Partial<DictionarySnapshot>,
  ) => {
    const state = stateFor(owner);
    state.snapshot = { ...state.snapshot, ...patch };
    for (const listener of state.listeners) listener();
  };

  const persist = (owner: DictionaryOwner) => {
    const state = stateFor(owner);
    try {
      getStorage()?.setItem(
        storageKey(owner),
        JSON.stringify({
          version: 2,
          owner,
          cached: state.cached,
          pending: state.pending,
        } satisfies PersistedDictionaryV2),
      );
    } catch {
      // Storage is an offline cache. A quota/privacy-mode failure must not
      // crash dictionary editing or leak data into another namespace.
    }
  };

  const enqueue = <T>(
    owner: DictionaryOwner,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const state = stateFor(owner);
    const result = state.queue.then(operation, operation);
    state.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const hydrate = (owner: DictionaryOwner) => {
    const state = stateFor(owner);
    if (state.hydrated) return;
    state.hydrated = true;
    let envelope: PersistedDictionaryV2 | null = null;
    try {
      const storage = getStorage();
      storage?.removeItem(LEGACY_STORAGE_KEY);
      envelope = parseDictionaryEnvelope(
        storage?.getItem(storageKey(owner)) ?? null,
        owner,
      );
    } catch {
      // Treat inaccessible/corrupt storage as an empty cache.
    }
    state.cached = envelope?.cached ?? [];
    state.pending = envelope?.pending ?? [];
    state.snapshot = {
      entries: mergeEntries(state.pending, state.cached),
      loading: owner !== "anonymous",
      error: null,
    };
    for (const listener of state.listeners) listener();
  };

  const flushPending = async (owner: DictionaryOwner, userId: string) => {
    const state = stateFor(owner);
    if (state.pending.length === 0) return;
    const remaining: TranscriptionDictionaryEntry[] = [];
    const synced: TranscriptionDictionaryEntry[] = [];
    for (const entry of state.pending) {
      try {
        synced.push(await api.create(userId, entry.term, entry.aliases));
      } catch {
        remaining.push(entry);
      }
    }
    state.pending = remaining;
    state.cached = mergeEntries(synced, state.cached);
  };

  const load = (owner: DictionaryOwner): Promise<void> => {
    hydrate(owner);
    const state = stateFor(owner);
    if (owner === "anonymous") {
      publish(owner, { loading: false });
      return Promise.resolve();
    }
    if (state.loadPromise) return state.loadPromise;
    const userId = userIdForOwner(owner) as string;
    const operation = enqueue(owner, async () => {
      publish(owner, { loading: true, error: null });
      try {
        const remote = cleanEntries(await api.list(userId));
        state.cached = remote;
        await flushPending(owner, userId);
        publish(owner, {
          entries: mergeEntries(state.pending, state.cached),
          loading: false,
          error:
            state.pending.length > 0
              ? "Couldn’t sync every dictionary term. Saved terms remain on this device."
              : null,
        });
        persist(owner);
      } catch {
        publish(owner, {
          entries: mergeEntries(state.pending, state.cached),
          loading: false,
          error: "Couldn’t sync your dictionary. Saved terms still work.",
        });
      }
    });
    const tracked = operation.finally(() => {
      if (state.loadPromise === tracked) state.loadPromise = null;
    });
    state.loadPromise = tracked;
    return tracked;
  };

  const replaceEntry = (
    owner: DictionaryOwner,
    previousId: string | null,
    entry: TranscriptionDictionaryEntry,
  ) => {
    const state = stateFor(owner);
    state.cached = mergeEntries(
      [entry],
      state.cached.filter((item) => item.id !== previousId),
    );
    publish(owner, { entries: mergeEntries(state.pending, state.cached) });
    persist(owner);
  };

  return {
    getSnapshot(owner: DictionaryOwner | null): DictionarySnapshot {
      return owner ? stateFor(owner).snapshot : EMPTY_SNAPSHOT;
    },

    subscribe(owner: DictionaryOwner | null, listener: () => void) {
      if (!owner) return () => undefined;
      const state = stateFor(owner);
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },

    load,

    clearError(owner: DictionaryOwner | null) {
      if (owner) publish(owner, { error: null });
    },

    add(owner: DictionaryOwner | null, term: string, aliases: string[]) {
      if (!owner) throw new Error("dictionary_owner_unresolved");
      const cleanTerm = cleanDictionaryValue(term);
      if (!dictionaryKey(cleanTerm)) throw new Error("bad_term");
      hydrate(owner);
      return enqueue(owner, async () => {
        publish(owner, { error: null });
        const userId = userIdForOwner(owner);
        if (!userId) {
          const entry = localEntry(createId, cleanTerm, aliases);
          replaceEntry(owner, null, entry);
          return entry;
        }
        try {
          const entry = await api.create(userId, cleanTerm, aliases);
          replaceEntry(owner, null, entry);
          return entry;
        } catch {
          const entry = localEntry(createId, cleanTerm, aliases);
          const state = stateFor(owner);
          state.pending = mergeEntries([entry], state.pending);
          publish(owner, {
            entries: mergeEntries(state.pending, state.cached),
            error: "Saved on this device; cloud sync will retry.",
          });
          persist(owner);
          return entry;
        }
      });
    },

    update(
      owner: DictionaryOwner | null,
      id: string,
      term: string,
      aliases: string[],
    ) {
      if (!owner) throw new Error("dictionary_owner_unresolved");
      const cleanTerm = cleanDictionaryValue(term);
      if (!dictionaryKey(cleanTerm)) throw new Error("bad_term");
      const cleanAliases = cleanDictionaryAliases(aliases).filter(
        (alias) => dictionaryKey(alias) !== dictionaryKey(cleanTerm),
      );
      hydrate(owner);
      return enqueue(owner, async () => {
        const userId = userIdForOwner(owner);
        const state = stateFor(owner);
        if (!userId || id.startsWith("local-")) {
          const local = { id, term: cleanTerm, aliases: cleanAliases };
          if (userId) {
            try {
              const entry = await api.create(userId, cleanTerm, cleanAliases);
              state.pending = state.pending.filter((item) => item.id !== id);
              replaceEntry(owner, id, entry);
              return entry;
            } catch {
              state.pending = mergeEntries(
                [local],
                state.pending.filter((item) => item.id !== id),
              );
            }
          }
          state.cached = state.cached.map((item) =>
            item.id === id ? local : item,
          );
          publish(owner, {
            entries: mergeEntries(state.pending, state.cached),
          });
          persist(owner);
          return local;
        }
        const entry = await api.update(userId, id, cleanTerm, cleanAliases);
        replaceEntry(owner, id, entry);
        return entry;
      });
    },

    remove(owner: DictionaryOwner | null, id: string) {
      if (!owner) throw new Error("dictionary_owner_unresolved");
      hydrate(owner);
      return enqueue(owner, async () => {
        const userId = userIdForOwner(owner);
        if (userId && !id.startsWith("local-")) await api.remove(userId, id);
        const state = stateFor(owner);
        state.cached = state.cached.filter((entry) => entry.id !== id);
        state.pending = state.pending.filter((entry) => entry.id !== id);
        publish(owner, { entries: mergeEntries(state.pending, state.cached) });
        persist(owner);
      });
    },
  };
}

async function responseEntry(response: Response) {
  if (!response.ok) throw new Error(`dictionary_${response.status}`);
  return ((await response.json()) as { entry: TranscriptionDictionaryEntry })
    .entry;
}

const requestHeaders = (userId: string, json = false): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  [DICTIONARY_OWNER_HEADER]: userId,
});

export const browserDictionaryApi: DictionaryApi = {
  async list(userId) {
    const response = await fetch("/api/transcription-dictionary", {
      headers: requestHeaders(userId),
    });
    if (!response.ok) throw new Error(`dictionary_load_${response.status}`);
    return (
      (await response.json()) as { entries: TranscriptionDictionaryEntry[] }
    ).entries;
  },
  async create(userId, term, aliases) {
    return responseEntry(
      await fetch("/api/transcription-dictionary", {
        method: "POST",
        headers: requestHeaders(userId, true),
        body: JSON.stringify({ term, aliases }),
      }),
    );
  },
  async update(userId, id, term, aliases) {
    return responseEntry(
      await fetch(`/api/transcription-dictionary/${id}`, {
        method: "PATCH",
        headers: requestHeaders(userId, true),
        body: JSON.stringify({ term, aliases }),
      }),
    );
  },
  async remove(userId, id) {
    const response = await fetch(`/api/transcription-dictionary/${id}`, {
      method: "DELETE",
      headers: requestHeaders(userId),
    });
    if (!response.ok) throw new Error(`dictionary_delete_${response.status}`);
  },
};
