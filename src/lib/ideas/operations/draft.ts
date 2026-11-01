import { isVersionFormat } from "@/lib/content/formats";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { getContentItem } from "@/lib/db/content";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { expansionToPatch } from "@/lib/ideas/expansion-patch";
import { chargedIdeaExpansion } from "@/lib/ideas/operations/expand";
import type { IdeaInput } from "@/lib/ideas/types";

type ContentRow = NonNullable<Awaited<ReturnType<typeof getContentItem>>>;

/** The idea already has a body; drafting it again would overwrite the
 * creator's work, which the composer never does either. */
export function hasDraft(item: ContentRow): boolean {
  return Boolean(item.script?.trim() || item.blocks.length);
}

function inputFrom(item: ContentRow): IdeaInput {
  const note = item.originalNote.trim();
  return {
    transcript: note ? note.slice(0, 8_000) : undefined,
    url: item.sourceUrl ?? undefined,
    source: item.sourceUrl
      ? {
          url: item.sourceUrl,
          title: item.sourceTitle ?? undefined,
          transcript: item.sourceTranscript?.slice(0, 30_000) ?? undefined,
          summary: item.sourceSummary ?? undefined,
          platform: item.sourcePlatform ?? undefined,
        }
      : undefined,
  };
}

/**
 * Write a saved idea's first draft and store it on the same row: the step the
 * composer runs after every capture, done on the server so Chirpy can run it
 * inside a turn. The creator's words are never touched.
 */
export async function draftSavedIdea(
  request: Request,
  userId: string,
  id: string,
  signal?: AbortSignal,
): Promise<OperationResult<ContentRow>> {
  const item = await getContentItem(userId, id);
  if (!item) return refused(404, "not_found");
  if (hasDraft(item)) return refused(409, "already_drafted");
  const input = inputFrom(item);
  if (!input.transcript && !input.url) return refused(400, "no_input");

  const format = isVersionFormat(item.leadFormat) ? item.leadFormat : "short";
  const expanded = await chargedIdeaExpansion(
    request,
    userId,
    input,
    format,
    signal,
  );
  if (!expanded.ok) return expanded;
  const saved = await updateOwnContentItem(userId, id, {
    ...expansionToPatch(expanded.value.expansion),
  });
  if (!saved.ok) return saved;
  return succeeded(saved.value.item);
}
