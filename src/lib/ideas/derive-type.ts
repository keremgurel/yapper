import type { IdeaInput, IdeaType } from "@/lib/ideas/types";

const has = (s: string | undefined): boolean => !!s && s.trim().length > 0;

/**
 * Decide an idea's type from what the creator actually gave us:
 * - a link with their own words attached -> semi-original (their take on it)
 * - a link on its own -> inspiration (something to study or riff on)
 * - words with no link -> original (a thought that is theirs from scratch)
 *
 * The creator never picks the type; it falls out of the input. This keeps the
 * capture surface a single "just drop it in" box rather than a form.
 */
export function deriveIdeaType(input: IdeaInput): IdeaType {
  const hasLink = has(input.url) || has(input.source?.url);
  const hasWords = has(input.transcript);
  if (hasLink && hasWords) return "semi-original";
  if (hasLink) return "inspiration";
  return "original";
}
