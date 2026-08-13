import type { ReferenceContentType } from "@/lib/inspiration/types";
import type { IdeaInput, IdeaSource } from "@/lib/ideas/types";

const REFERENCE_TYPES = new Set<ReferenceContentType>([
  "social-video",
  "article",
  "research-paper",
  "report",
  "web-resource",
]);
const MAX_TOTAL_PROMPT_CHARS = 40_000;

const boundedString = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.trim() && value.length <= max
    ? value
    : undefined;

/** Validate the client-controlled material that is interpolated into expansion prompts. */
export function parseExpandIdeaInput(value: unknown): IdeaInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const transcript = boundedString(raw.transcript, 8_000);
  const url = boundedString(raw.url, 2_048);
  if (raw.transcript !== undefined && transcript === undefined) return null;
  if (raw.url !== undefined && url === undefined) return null;

  let source: IdeaSource | undefined;
  if (raw.source !== undefined) {
    if (
      !raw.source ||
      typeof raw.source !== "object" ||
      Array.isArray(raw.source)
    )
      return null;
    const candidate = raw.source as Record<string, unknown>;
    const sourceUrl = boundedString(candidate.url, 2_048);
    const title = boundedString(candidate.title, 300);
    const sourceTranscript = boundedString(candidate.transcript, 30_000);
    const summary = boundedString(candidate.summary, 4_000);
    const platform = boundedString(candidate.platform, 30);
    if (!sourceUrl) return null;
    if (candidate.title !== undefined && title === undefined) return null;
    if (candidate.transcript !== undefined && sourceTranscript === undefined)
      return null;
    if (candidate.summary !== undefined && summary === undefined) return null;
    if (candidate.platform !== undefined && platform === undefined) return null;
    const referenceType = candidate.referenceType;
    if (
      referenceType !== undefined &&
      (typeof referenceType !== "string" ||
        !REFERENCE_TYPES.has(referenceType as ReferenceContentType))
    )
      return null;
    source = {
      url: sourceUrl,
      ...(title === undefined ? {} : { title }),
      ...(sourceTranscript === undefined
        ? {}
        : { transcript: sourceTranscript }),
      ...(summary === undefined ? {} : { summary }),
      ...(platform === undefined ? {} : { platform }),
      ...(referenceType === undefined
        ? {}
        : { referenceType: referenceType as ReferenceContentType }),
    };
  }

  const input: IdeaInput = {
    ...(transcript === undefined ? {} : { transcript }),
    ...(url === undefined ? {} : { url }),
    ...(source === undefined ? {} : { source }),
  };
  if (
    !input.transcript?.trim() &&
    !input.url?.trim() &&
    !input.source?.url.trim()
  )
    return null;
  const promptCharacters =
    (input.transcript?.length ?? 0) +
    (input.url?.length ?? 0) +
    (input.source?.url.length ?? 0) +
    (input.source?.title?.length ?? 0) +
    (input.source?.transcript?.length ?? 0) +
    (input.source?.summary?.length ?? 0) +
    (input.source?.platform?.length ?? 0);
  return promptCharacters <= MAX_TOTAL_PROMPT_CHARS ? input : null;
}
