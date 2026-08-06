import { normalizeBlocks } from "@/lib/content/normalize";
import type { ContentItemInput } from "@/lib/db/content";
import {
  ideaTypes,
  transcriptStatuses,
  type IdeaTypeValue,
  type TranscriptStatus,
} from "@/lib/db/schema";

// Clamps. The reference transcript is the generous one on purpose: it is the
// single most valuable thing an idea carries, and truncating it would quietly
// degrade every expansion built on top of it.
const NOTE_MAX = 20_000;
const TRANSCRIPT_MAX = 100_000;
const SUMMARY_MAX = 8_000;
const SHORT_MAX = 120;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.slice(0, max) : undefined;

const isIdeaType = (v: unknown): v is IdeaTypeValue =>
  typeof v === "string" && (ideaTypes as readonly string[]).includes(v);

const isTranscriptStatus = (v: unknown): v is TranscriptStatus =>
  typeof v === "string" &&
  (transcriptStatuses as readonly string[]).includes(v);

/**
 * Parse the idea-specific half of a payload: the creator's verbatim words, the
 * resolved reference, and the AI-built body. Complements `parseContentInput`,
 * which owns the fields both surfaces share.
 *
 * Unknown keys are dropped and invalid values ignored, so a partial save never
 * clobbers a field the client did not mean to send.
 */
export function parseIdeaFields(
  body: Record<string, unknown>,
): Partial<ContentItemInput> {
  const input: Partial<ContentItemInput> = {};

  const note = str(body.originalNote, NOTE_MAX);
  if (note !== undefined) input.originalNote = note;

  if (Array.isArray(body.blocks)) input.blocks = normalizeBlocks(body.blocks);

  if (body.format === null) input.format = null;
  else {
    const format = str(body.format, SHORT_MAX);
    if (format !== undefined) input.format = format;
  }

  if (body.summary === null) input.summary = null;
  else {
    const summary = str(body.summary, SUMMARY_MAX);
    if (summary !== undefined) input.summary = summary;
  }

  if (body.ideaType === null) input.ideaType = null;
  else if (isIdeaType(body.ideaType)) input.ideaType = body.ideaType;

  if (body.sourceTranscript === null) input.sourceTranscript = null;
  else {
    const transcript = str(body.sourceTranscript, TRANSCRIPT_MAX);
    if (transcript !== undefined) input.sourceTranscript = transcript;
  }

  if (body.sourceSummary === null) input.sourceSummary = null;
  else {
    const summary = str(body.sourceSummary, SUMMARY_MAX);
    if (summary !== undefined) input.sourceSummary = summary;
  }

  const referenceType = str(body.sourceReferenceType, SHORT_MAX);
  if (referenceType !== undefined) input.sourceReferenceType = referenceType;

  const platform = str(body.sourcePlatform, SHORT_MAX);
  if (platform !== undefined) input.sourcePlatform = platform;

  if (body.transcriptStatus === null) input.transcriptStatus = null;
  else if (isTranscriptStatus(body.transcriptStatus)) {
    input.transcriptStatus = body.transcriptStatus;
  }

  return input;
}
