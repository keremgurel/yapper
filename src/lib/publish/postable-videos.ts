import type { ContentSummary } from "@/lib/content/client";

/** A finished take ready to cross-post: a library item that has a recorded
 * submission behind it. `submissionId` is non-null by construction. */
export interface PostableVideo {
  id: string;
  title: string;
  submissionId: string;
  status: ContentSummary["status"];
  scheduledFor: string | null;
  updatedAt: string;
  noSpeech?: boolean;
  transcriptStatus: ContentSummary["transcriptStatus"];
}

/**
 * The library items that can actually be posted: the ones with a recorded take
 * (a `submissionId`) behind them, newest first. A blank title becomes
 * "Untitled" so the Poster never shows an empty row. Pure, so the Poster list
 * and any "post to all" action agree on exactly which videos are postable.
 */
export function postableVideos(
  items: ContentSummary[] | null,
): PostableVideo[] {
  if (!items) return [];
  return items
    .filter((it): it is ContentSummary & { submissionId: string } =>
      Boolean(it.submissionId),
    )
    .map((it) => ({
      id: it.id,
      title: it.title.trim() || "Untitled",
      submissionId: it.submissionId,
      status: it.status,
      scheduledFor: it.scheduledFor,
      updatedAt: it.updatedAt,
      transcriptStatus: it.transcriptStatus,
      noSpeech:
        it.recordedTranscript !== undefined
          ? it.transcriptStatus === "ready" && it.recordedTranscript === ""
          : it.noSpeech === true,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Raw recordings aren't final edits. Uploaded files have their own tab. */
export function posterLibraryVideos(
  items: ContentSummary[] | null,
  source: "yapper" | "uploads",
): PostableVideo[] {
  const sorted = [...(items ?? [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const projects = new Set<string>();
  return postableVideos(
    sorted.filter((item) => {
      if (source === "uploads")
        return item.sourceUrl === "yapper://poster-upload";
      if (
        !item.sourceUrl?.startsWith("yapper://project/") ||
        projects.has(item.sourceUrl)
      )
        return false;
      projects.add(item.sourceUrl);
      return true;
    }),
  );
}
