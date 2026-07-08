import type { ContentStatus } from "@/lib/db/schema";

/** Row shape from GET /api/content (list summaries). */
export interface ContentSummary {
  id: string;
  title: string;
  status: ContentStatus;
  scheduledFor: string | null;
  submissionId: string | null;
  /** The content pillar this idea is classified under (shown as a chip). */
  pillar: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Full row from GET /api/content/[id]. */
export interface ContentDetail extends ContentSummary {
  hooks: string[];
  points: string[];
  example: string;
  cta: string;
  script: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
}

/** Fields a client can write (mirrors the API's parseContentInput). */
export interface ContentPatch {
  title?: string;
  hooks?: string[];
  points?: string[];
  example?: string;
  cta?: string;
  script?: string | null;
  status?: ContentStatus;
  pillar?: string | null;
  scheduledFor?: string | null;
  sourceUrl?: string;
  sourceTitle?: string;
  submissionId?: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`content_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listContent(): Promise<ContentSummary[]> {
  const data = await json<{ items: ContentSummary[] }>(
    await fetch("/api/content"),
  );
  return data.items;
}

export async function getContent(id: string): Promise<ContentDetail> {
  const data = await json<{ item: ContentDetail }>(
    await fetch(`/api/content/${id}`),
  );
  return data.item;
}

export async function createContent(
  patch: ContentPatch = {},
): Promise<ContentDetail> {
  const data = await json<{ item: ContentDetail }>(
    await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return data.item;
}

/** `keepalive` lets a final flush survive a hard navigation (pagehide). */
export async function patchContent(
  id: string,
  patch: ContentPatch,
  opts: { keepalive?: boolean } = {},
): Promise<ContentDetail> {
  const data = await json<{ item: ContentDetail }>(
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      keepalive: opts.keepalive,
    }),
  );
  return data.item;
}

/** Talk-or-type capture: enrich a rough idea into a titled/classified item and
 * persist it. Returns the created row (+ the pillar it was classified under). */
export async function captureContent(
  text: string,
  pillars: string[],
): Promise<{ item: ContentDetail; pillar?: string }> {
  return json<{ item: ContentDetail; pillar?: string }>(
    await fetch("/api/content/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, pillars }),
    }),
  );
}

/** One turn of the "make your own banger from this clip" chat. */
export async function brainstormReply(payload: {
  messages: { role: "user" | "assistant"; content: string }[];
  clip: Record<string, unknown>;
  pillars: string[];
}): Promise<string> {
  const data = await json<{ reply: string }>(
    await fetch("/api/content/brainstorm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  return data.reply;
}

export async function deleteContent(id: string): Promise<void> {
  await json<{ ok: boolean }>(
    await fetch(`/api/content/${id}`, { method: "DELETE" }),
  );
}

/** Default a newly scheduled item to tomorrow morning; the user refines it in
 * the workbench. The API (and DB CHECK) require scheduled items to carry a
 * date. */
export function defaultScheduleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
