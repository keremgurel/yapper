/**
 * Persist the studio project across page refreshes. Editing state (clips, words,
 * captions, settings) is small JSON; the heavy part is the media, which we keep
 * as Blobs in IndexedDB and re-hydrate into fresh object URLs on load.
 *
 * Media URLs are ephemeral object URLs, so in the stored snapshot every url is
 * replaced with a stable "ref:<id>" placeholder that points at a Blob record.
 */
import type {
  AudioTrack,
  Caption,
  Clip,
  MediaAsset,
  Overlay,
  StudioSource,
  Word,
} from "@/lib/studio/types";
import type { CaptionStyle } from "@/lib/studio/captions";

export interface ProjectState {
  source: StudioSource | null;
  clips: Clip[];
  words: Word[];
  captions: Caption[];
  captionStyle: CaptionStyle;
  captionLines: number;
  captionWords: number;
  captionApplyAll: boolean;
  overlays: Overlay[];
  mediaAssets: MediaAsset[];
  audioTracks: AudioTrack[];
}

interface Snapshot extends ProjectState {
  v: 1;
}

const DB_NAME = "yapper-studio";
const STORE = "kv";
const PROJECT_KEY = "project";
const BLOB_PREFIX = "blob:";
const REF_PREFIX = "ref:";

// Session maps so a given media Blob is written once and reused across saves.
const urlToId = new Map<string, string>();
let idCounter = 0;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const idbGet = <T>(key: string) => tx<T>("readonly", (s) => s.get(key));
const idbSet = (key: string, val: unknown) =>
  tx("readwrite", (s) => s.put(val, key));
const idbDel = (key: string) => tx("readwrite", (s) => s.delete(key));
const idbKeys = () =>
  tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()) as Promise<string[]>;

/** Collect every media url referenced anywhere in the project. */
function collectUrls(s: ProjectState): Set<string> {
  const urls = new Set<string>();
  if (s.source) urls.add(s.source.url);
  for (const c of s.clips) if (c.src) urls.add(c.src.url);
  for (const o of s.overlays) urls.add(o.url);
  for (const m of s.mediaAssets) urls.add(m.url);
  for (const a of s.audioTracks) urls.add(a.url);
  return urls;
}

const refOf = (url: string) => `${REF_PREFIX}${urlToId.get(url)}`;
const withUrl = <T extends { url: string }>(o: T): T => ({
  ...o,
  url: refOf(o.url),
});

/**
 * Save the project. New media Blobs are fetched from their object URLs and
 * written once; the JSON snapshot (with url placeholders) is rewritten each
 * call. Orphaned Blobs are pruned. Never throws — persistence is best-effort.
 */
export async function saveProject(state: ProjectState): Promise<void> {
  try {
    const urls = collectUrls(state);
    // Assign ids + persist any Blob we haven't stored yet this session.
    for (const url of urls) {
      if (urlToId.has(url)) continue;
      const id = `m${idCounter++}`;
      urlToId.set(url, id);
      const blob = await fetch(url).then((r) => r.blob());
      await idbSet(`${BLOB_PREFIX}${id}`, blob);
    }

    const snapshot: Snapshot = {
      v: 1,
      source: state.source ? withUrl(state.source) : null,
      clips: state.clips.map((c) =>
        c.src ? { ...c, src: withUrl(c.src) } : c,
      ),
      words: state.words,
      captions: state.captions,
      captionStyle: state.captionStyle,
      captionLines: state.captionLines,
      captionWords: state.captionWords,
      captionApplyAll: state.captionApplyAll,
      overlays: state.overlays.map(withUrl),
      mediaAssets: state.mediaAssets.map(withUrl),
      audioTracks: state.audioTracks.map(withUrl),
    };
    await idbSet(PROJECT_KEY, snapshot);

    // Prune Blob records no longer referenced by the current snapshot.
    const liveIds = new Set([...urls].map((u) => urlToId.get(u)));
    const keys = await idbKeys();
    await Promise.all(
      keys
        .filter(
          (k) =>
            k.startsWith(BLOB_PREFIX) &&
            !liveIds.has(k.slice(BLOB_PREFIX.length)),
        )
        .map((k) => idbDel(k)),
    );
  } catch {
    // storage full / unavailable — ignore, editing continues
  }
}

/**
 * Restore the last saved project, re-hydrating media Blobs into fresh object
 * URLs. Entities whose Blob is missing are dropped; returns null if nothing was
 * saved or the base source can't be rebuilt.
 */
export async function restoreProject(): Promise<ProjectState | null> {
  try {
    const snap = await idbGet<Snapshot>(PROJECT_KEY);
    if (!snap || snap.v !== 1) return null;

    const idToUrl = new Map<string, string>();
    const resolve = (ref: string): string | null => {
      if (!ref.startsWith(REF_PREFIX)) return ref;
      const id = ref.slice(REF_PREFIX.length);
      if (idToUrl.has(id)) return idToUrl.get(id)!;
      return null; // resolved lazily below
    };

    // Build id -> object URL for every stored Blob we can find.
    const ids = new Set<string>();
    const gather = (ref?: string) => {
      if (ref?.startsWith(REF_PREFIX)) ids.add(ref.slice(REF_PREFIX.length));
    };
    gather(snap.source?.url);
    snap.clips.forEach((c) => gather(c.src?.url));
    snap.overlays.forEach((o) => gather(o.url));
    snap.mediaAssets.forEach((m) => gather(m.url));
    snap.audioTracks.forEach((a) => gather(a.url));

    for (const id of ids) {
      const blob = await idbGet<Blob>(`${BLOB_PREFIX}${id}`);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      idToUrl.set(id, url);
      urlToId.set(url, id); // so the next save reuses this Blob, no re-fetch
    }

    if (!snap.source) return null;
    const sourceUrl = resolve(snap.source.url);
    if (!sourceUrl) return null; // base media lost -> nothing to restore

    const keepUrl = <T extends { url: string }>(o: T): T | null => {
      const url = resolve(o.url);
      return url ? { ...o, url } : null;
    };

    return {
      source: { ...snap.source, url: sourceUrl },
      clips: snap.clips
        .map((c) => {
          if (!c.src) return c;
          const url = resolve(c.src.url);
          return url ? { ...c, src: { ...c.src, url } } : null;
        })
        .filter((c): c is Clip => c !== null),
      words: snap.words,
      captions: snap.captions,
      captionStyle: snap.captionStyle,
      captionLines: snap.captionLines,
      captionWords: snap.captionWords,
      captionApplyAll: snap.captionApplyAll,
      overlays: snap.overlays
        .map(keepUrl)
        .filter((o): o is Overlay => o !== null),
      mediaAssets: snap.mediaAssets
        .map(keepUrl)
        .filter((m): m is MediaAsset => m !== null),
      audioTracks: snap.audioTracks
        .map(keepUrl)
        .filter((a): a is AudioTrack => a !== null),
    };
  } catch {
    return null;
  }
}

/** Wipe the persisted project and all stored Blobs. */
export async function clearProject(): Promise<void> {
  try {
    urlToId.clear();
    const keys = await idbKeys();
    await Promise.all(
      keys
        .filter((k) => k === PROJECT_KEY || k.startsWith(BLOB_PREFIX))
        .map((k) => idbDel(k)),
    );
  } catch {
    // ignore
  }
}
