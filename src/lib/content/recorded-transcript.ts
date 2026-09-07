import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";

/**
 * Plain words out of whatever shape a submission's transcript was stored in:
 * a string, a list of words, or an envelope with a words list.
 */
export function transcriptJsonToText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const words = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { words?: unknown }).words)
      ? (value as { words: unknown[] }).words
      : [];
  return words
    .map((word) =>
      typeof word === "string"
        ? word
        : word &&
            typeof word === "object" &&
            typeof (word as { text?: unknown }).text === "string"
          ? (word as { text: string }).text
          : "",
    )
    .map((word) => word.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * What the creator said in the video shot for this idea.
 *
 * The handoff writes it onto the item; an older take that was only linked
 * still has its transcript on the submission, so that is read as a fallback.
 */
export async function loadRecordedTranscript(
  userId: string,
  item: {
    recordedTranscript?: string | null;
    submissionId?: string | null;
    sourceUrl?: string | null;
    sourceTranscript?: string | null;
  },
): Promise<string | null> {
  const own = item.recordedTranscript?.trim();
  if (own) return own;
  // Older Poster uploads saved the export's speech in the inspiration field.
  // Only this explicit upload marker makes that field the creator's own video.
  if (
    item.sourceUrl === "yapper://poster-upload" &&
    item.sourceTranscript?.trim()
  ) {
    return item.sourceTranscript.trim();
  }
  if (!item.submissionId) return null;
  const [row] = await getDb()
    .select({ transcript: submissions.transcript })
    .from(submissions)
    .where(
      and(
        eq(submissions.id, item.submissionId),
        eq(submissions.userId, userId),
      ),
    )
    .limit(1);
  const text = transcriptJsonToText(row?.transcript);
  return text || null;
}
