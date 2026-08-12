import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionDictionaryEntry } from "./transcription-dictionary";
import {
  createDictionaryRepository,
  parseDictionaryEnvelope,
  resolveDictionaryOwner,
  type DictionaryApi,
  type DictionaryStorage,
} from "./transcription-dictionary-repository";

const entry = (id: string, term: string): TranscriptionDictionaryEntry => ({
  id,
  term,
  aliases: [],
});

class MemoryStorage implements DictionaryStorage {
  readonly values = new Map<string, string>();
  readonly removed: string[] = [];

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.removed.push(key);
    this.values.delete(key);
  }
}

const api = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
} satisfies DictionaryApi;
let storage: MemoryStorage;
let nextId: number;

const repository = () =>
  createDictionaryRepository({
    api,
    getStorage: () => storage,
    createId: () => `id-${++nextId}`,
  });

beforeEach(() => {
  vi.clearAllMocks();
  storage = new MemoryStorage();
  nextId = 0;
  api.list.mockResolvedValue([]);
  api.create.mockImplementation(async (_userId, term, aliases) => ({
    id: `remote-${term}`,
    term,
    aliases,
  }));
  api.update.mockImplementation(async (_userId, id, term, aliases) => ({
    id,
    term,
    aliases,
  }));
  api.remove.mockResolvedValue(undefined);
});

describe("dictionary v2 envelopes", () => {
  it("derives distinct owners and hides all data while auth is unresolved", () => {
    expect(resolveDictionaryOwner(false, "A")).toBeNull();
    expect(resolveDictionaryOwner(true)).toBe("anonymous");
    expect(resolveDictionaryOwner(true, "A")).toBe("user:A");
    expect(resolveDictionaryOwner(true, "B")).toBe("user:B");
  });

  it("accepts only the expected owner and sanitizes entries", () => {
    const raw = JSON.stringify({
      version: 2,
      owner: "user:A",
      cached: [{ id: "one", term: "  Yapper  ", aliases: [" yap-er "] }],
      pending: [{ id: "remote-not-pending", term: "Other", aliases: [] }],
    });

    expect(parseDictionaryEnvelope(raw, "user:A")).toEqual({
      version: 2,
      owner: "user:A",
      cached: [{ id: "one", term: "Yapper", aliases: ["yap-er"] }],
      pending: [],
    });
    expect(parseDictionaryEnvelope(raw, "user:B")).toBeNull();
    expect(parseDictionaryEnvelope("{broken", "user:A")).toBeNull();
  });
});

describe("owner-scoped dictionary repository", () => {
  it("never exposes one owner's entries to another owner", async () => {
    api.list.mockImplementation(async (userId) => [
      entry(`remote-${userId}`, `Term ${userId}`),
    ]);
    const repo = repository();

    await repo.load("user:A");

    expect(repo.getSnapshot("user:A").entries).toEqual([
      entry("remote-A", "Term A"),
    ]);
    expect(repo.getSnapshot("user:B").entries).toEqual([]);
    expect(repo.getSnapshot("anonymous").entries).toEqual([]);
  });

  it("keeps reverse-order A and B responses in their initiating stores", async () => {
    let resolveA!: (entries: TranscriptionDictionaryEntry[]) => void;
    let resolveB!: (entries: TranscriptionDictionaryEntry[]) => void;
    api.list.mockImplementation(
      (userId) =>
        new Promise((resolve) => {
          if (userId === "A") resolveA = resolve;
          else resolveB = resolve;
        }),
    );
    const repo = repository();
    const loadA = repo.load("user:A");
    const loadB = repo.load("user:B");
    await vi.waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    resolveB([entry("b", "Beta")]);
    await loadB;
    resolveA([entry("a", "Alpha")]);
    await loadA;

    expect(repo.getSnapshot("user:A").entries).toEqual([entry("a", "Alpha")]);
    expect(repo.getSnapshot("user:B").entries).toEqual([entry("b", "Beta")]);
  });

  it("deduplicates simultaneous loads from both hook consumers", async () => {
    let resolve!: (entries: TranscriptionDictionaryEntry[]) => void;
    api.list.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const repo = repository();

    const first = repo.load("user:A");
    const second = repo.load("user:A");
    await vi.waitFor(() => expect(api.list).toHaveBeenCalledOnce());
    expect(api.list).toHaveBeenCalledOnce();

    resolve([]);
    await Promise.all([first, second]);
  });

  it("serializes add, update, and delete behind an older list response", async () => {
    let resolve!: (entries: TranscriptionDictionaryEntry[]) => void;
    api.list.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const repo = repository();
    const loading = repo.load("user:A");
    const adding = repo.add("user:A", "Added", []);

    expect(api.create).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(api.list).toHaveBeenCalledOnce());
    resolve([entry("existing", "Before")]);
    await loading;
    await adding;
    await repo.update("user:A", "existing", "After", []);
    await repo.remove("user:A", "existing");

    expect(repo.getSnapshot("user:A").entries).toEqual([
      entry("remote-Added", "Added"),
    ]);
    expect(api.update).toHaveBeenCalledWith("A", "existing", "After", []);
    expect(api.remove).toHaveBeenCalledWith("A", "existing");
  });

  it("keeps a failed A add in A's outbox only", async () => {
    api.create.mockRejectedValue(new Error("offline"));
    const repo = repository();
    await repo.load("user:A");

    const added = await repo.add("user:A", "Alpha", []);

    expect(added.id).toBe("local-id-1");
    expect(repo.getSnapshot("user:A").entries).toEqual([added]);
    expect(repo.getSnapshot("user:B").entries).toEqual([]);
    expect(repo.getSnapshot("anonymous").entries).toEqual([]);
    expect(
      [...storage.values.entries()].find(([key]) =>
        key.includes("user%3AA"),
      )?.[1],
    ).toContain("local-id-1");
  });

  it("cannot drop a new failed add while an older outbox retry is paused", async () => {
    const key = `yapper:transcription-dictionary:v2:${encodeURIComponent("user:A")}`;
    storage.values.set(
      key,
      JSON.stringify({
        version: 2,
        owner: "user:A",
        cached: [],
        pending: [entry("local-old", "Old pending")],
      }),
    );
    let rejectOld!: (error: Error) => void;
    api.create
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      )
      .mockRejectedValueOnce(new Error("still offline"));
    const repo = repository();
    const loading = repo.load("user:A");
    await vi.waitFor(() => expect(api.create).toHaveBeenCalledOnce());

    const adding = repo.add("user:A", "New pending", []);
    rejectOld(new Error("offline"));
    await loading;
    await adding;

    expect(repo.getSnapshot("user:A").entries.map((item) => item.term)).toEqual(
      ["New pending", "Old pending"],
    );
    api.list.mockRejectedValue(new Error("offline"));
    const restored = repository();
    await restored.load("user:A");
    expect(
      restored.getSnapshot("user:A").entries.map((item) => item.term),
    ).toEqual(["New pending", "Old pending"]);
  });

  it("does not migrate ambiguous v1 data or upload it", async () => {
    storage.values.set(
      "yapper:transcription-dictionary:v1",
      JSON.stringify([entry("legacy", "Private A term")]),
    );
    const repo = repository();

    await repo.load("user:B");

    expect(repo.getSnapshot("user:B").entries).toEqual([]);
    expect(api.create).not.toHaveBeenCalled();
    expect(storage.removed).toContain("yapper:transcription-dictionary:v1");
  });

  it("hydrates persisted state before a mutation can run ahead of load", async () => {
    const key = `yapper:transcription-dictionary:v2:${encodeURIComponent("anonymous")}`;
    storage.values.set(
      key,
      JSON.stringify({
        version: 2,
        owner: "anonymous",
        cached: [entry("local-old", "Old")],
        pending: [],
      }),
    );
    const repo = repository();

    await repo.update("anonymous", "local-old", "Updated", [
      "Updated",
      " alias ",
    ]);
    await repo.add("anonymous", "Added", []);

    expect(repo.getSnapshot("anonymous").entries).toEqual([
      entry("local-id-1", "Added"),
      { id: "local-old", term: "Updated", aliases: ["alias"] },
    ]);
    await repo.remove("anonymous", "local-old");
    expect(repo.getSnapshot("anonymous").entries).toEqual([
      entry("local-id-1", "Added"),
    ]);
    expect(storage.values.get(key)).toContain("local-id-1");
    expect(storage.values.get(key)).not.toContain("local-old");
  });

  it("survives unavailable browser storage", async () => {
    const repo = createDictionaryRepository({
      api,
      getStorage: () => {
        throw new Error("privacy mode");
      },
      createId: () => "safe",
    });

    await expect(repo.load("anonymous")).resolves.toBeUndefined();
    await expect(repo.add("anonymous", "Local", [])).resolves.toMatchObject({
      term: "Local",
    });
  });
});
