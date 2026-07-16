import { decodeEntities } from "./html-entities";

export interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

/**
 * Extract the balanced JSON array that follows `"key":` in a blob. A plain regex
 * fails because caption track entries contain nested arrays (name.runs), so we
 * bracket-match while respecting string literals.
 */
export function extractArray(html: string, key: string): string | null {
  const marker = `"${key}":`;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const open = start + marker.length;
  if (html[open] !== "[") return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return html.slice(open, i + 1);
  }
  return null;
}

/** Prefer a manual English track, then any English, then whatever is first. */
export function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const manualEn = tracks.find(
    (t) => t.languageCode?.startsWith("en") && t.kind !== "asr",
  );
  const anyEn = tracks.find((t) => t.languageCode?.startsWith("en"));
  return manualEn ?? anyEn ?? tracks[0];
}

/**
 * Flatten a timedtext XML payload into one transcript string: strip the markup
 * inside each `<text>` cue, decode entities, and collapse whitespace. Returns
 * null when nothing survives. The cue body is matched with `[\s\S]` rather than
 * `.` on purpose: a manual caption cue often wraps onto two lines with a newline
 * inside the element, and `.` (no dotAll on this TS target) would fail to match
 * that cue and drop it out of the transcript entirely.
 */
export function parseTimedText(xml: string): string | null {
  const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim(),
  );
  const transcript = lines.filter(Boolean).join(" ").replace(/\s+/g, " ");
  return transcript.length > 0 ? transcript : null;
}
