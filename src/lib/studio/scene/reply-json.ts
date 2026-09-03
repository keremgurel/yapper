/**
 * The JSON object inside a model reply, which may be fenced, prefaced, or
 * followed by chatter even with `response_format` set. Anything that is not
 * an object is null: the callers drop what they cannot read rather than
 * trusting it downstream, as `parsePlacements` does.
 */
export function extractJsonObject(
  content: string,
): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(content.slice(start, end + 1));
    return parsed != null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function replyString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}
