import type { IdeaExpansion, IdeaInput, IdeaSource } from "@/lib/ideas/types";
import type { ResolvedLink } from "@/lib/inspiration/types";
import type {
  ContentStage,
  ContentStatus,
  IdeaTypeValue,
  TranscriptStatus,
} from "@/lib/db/schema";

/** One row as both surfaces list it. Same shape for the bank and the library;
 * only the default filter and the visible columns differ. */
export interface ItemSummary {
  id: string;
  title: string;
  status: ContentStatus;
  stage: ContentStage;
  ideaType: IdeaTypeValue | null;
  scheduledFor: string | null;
  submissionId: string | null;
  pillar: string | null;
  pillarId: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourcePlatform: string | null;
  transcriptStatus: TranscriptStatus | null;
  script: string | null;
  originalNote: string;
  updatedAt: string;
  createdAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`ideas_api_${res.status}`);
  return (await res.json()) as T;
}

/** Everything in the Idea Bank inbox. */
export async function listIdeas(): Promise<ItemSummary[]> {
  const data = await json<{ items: ItemSummary[] }>(await fetch("/api/ideas"));
  return data.items;
}

/** Capture an idea. Returns immediately with the stored row: the creator's
 * words are durable before any AI work starts. */
export async function createIdea(fields: {
  originalNote?: string;
  sourceUrl?: string;
  ideaType?: IdeaTypeValue;
  transcriptStatus?: TranscriptStatus;
}): Promise<ItemSummary> {
  const data = await json<{ item: ItemSummary }>(
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }),
  );
  return data.item;
}

/** Resolve the reference before analysis so its link, title, platform, and
 * original transcript are stored on the idea rather than thrown away. */
export async function resolveIdeaSourceRemote(
  url: string,
): Promise<IdeaSource> {
  const res = await fetch("/api/inspiration/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`resolve_${res.status}`);
  const resolved = (await res.json()) as ResolvedLink;
  return {
    url,
    title: resolved.title,
    platform: resolved.platform,
    transcript: resolved.transcript,
    summary: resolved.summary,
    referenceType: resolved.referenceType,
  };
}

/**
 * Ask the server to expand a raw idea into its full plan. Throws on failure so
 * the caller can keep the idea un-expanded and offer a retry rather than lose
 * the creator's captured words.
 */
export async function expandIdeaRemote(
  input: IdeaInput,
): Promise<IdeaExpansion> {
  const res = await fetch("/api/ideas/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Pillars and voice are read server-side from the creator's project, not
    // sent from here: the client must not be able to claim a different brain.
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`expand_${res.status}`);
  const data = (await res.json()) as { expansion?: IdeaExpansion };
  if (!data.expansion) throw new Error("expand_empty");
  return data.expansion;
}

export type BulkAction =
  | { action: "stage"; stage: ContentStage }
  | { action: "delete" }
  | { action: "pillar"; pillarId: string | null }
  | { action: "status"; status: ContentStatus };

/** Apply one action to many items. Used by the shared multi-select bar on both
 * the Idea Bank and the Content Library. */
export async function bulkItems(
  ids: string[],
  action: BulkAction,
): Promise<number> {
  const data = await json<{ updated: number }>(
    await fetch("/api/content/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...action }),
    }),
  );
  return data.updated;
}

/** Bulk-import saved references into the bank. Returns how many were new;
 * re-running the same archive imports nothing. */
export async function importSavedReferences(
  entries: { url: string; title?: string; savedAt?: number }[],
): Promise<number> {
  const data = await json<{ imported: number }>(
    await fetch("/api/ideas/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    }),
  );
  return data.imported;
}

/** Send ideas to the Content Library. A stage flip, nothing more: the item that
 * arrives is byte-for-byte the item that left the bank. */
export function sendToLibrary(ids: string[]): Promise<number> {
  return bulkItems(ids, { action: "stage", stage: "library" });
}
