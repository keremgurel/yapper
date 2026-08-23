import type { NewBrainBlock } from "@/lib/brain/client";
import {
  describePaste,
  detectPaste,
  type DetectedPaste,
} from "@/lib/brain/detect";
import type { IngestProposal } from "@/lib/brain/ingest";

/**
 * Reading a paste in the browser, and asking the server only to name it.
 *
 * The parse happens here, in full, before anything is uploaded. That is what
 * makes a five thousand row export feel instant and cost the same as five rows:
 * the creator sees their table laid out immediately, and the only thing that
 * crosses the network is twenty rows and a sentence describing the shape.
 */

/** Files a creator actually has lying around. Anything else is a paste. */
export const IMPORTABLE_EXTENSIONS = [".csv", ".tsv", ".txt", ".md", ".json"];

/** Two megabytes of text is a very large export and a very small upload. Past
 * it, the browser is the wrong place to be parsing. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface IngestDraft {
  detected: DetectedPaste;
  proposal: IngestProposal;
}

/** What the creator lands on before anything is saved: the parse, plus a name
 * that is a guess until either they or the model improves it. */
export function draftFromPaste(text: string): IngestDraft {
  const detected = detectPaste(text);
  return {
    detected,
    proposal: {
      title: "",
      digest: "",
      tags: [],
      usage: "auto",
      sourceLabel: "",
    },
  };
}

export async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("file_too_large");
  return file.text();
}

/** Ask for a title, a digest and tags. Costs one credit, and the creator edits
 * whatever comes back before it is saved. */
export async function nameIt(
  detected: DetectedPaste,
  signal?: AbortSignal,
): Promise<IngestProposal> {
  const res = await fetch("/api/brain/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sample: detected.sample,
      shape: describePaste(detected),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`ingest_api_${res.status}`);
  return ((await res.json()) as { proposal: IngestProposal }).proposal;
}

/** The draft, as the block create endpoint wants it. */
export function draftToBlock(draft: IngestDraft): NewBrainBlock {
  const { detected, proposal } = draft;
  return {
    title: proposal.title,
    kind: detected.kind,
    body: detected.body,
    items: detected.items,
    rows: detected.rows,
    digest: proposal.digest,
    usage: proposal.usage,
    tags: proposal.tags,
    sourceLabel: proposal.sourceLabel,
  };
}

export type { DetectedPaste, IngestProposal };
