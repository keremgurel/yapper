const TIMESTAMP = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->/;

/**
 * The spoken words out of a WebVTT caption file.
 *
 * Headers, cue ids, timing lines and styling tags go; consecutive duplicate
 * lines (rolling captions repeat the previous cue) collapse to one.
 */
export function vttToText(body: string): string {
  const lines: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/<[^>]+>/g, "").trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line) || /^NOTE\b/.test(line)) continue;
    if (TIMESTAMP.test(line) || /^\d+$/.test(line)) continue;
    if (/^(Kind|Language|X-TIMESTAMP-MAP):/i.test(line)) continue;
    if (lines[lines.length - 1] === line) continue;
    lines.push(line);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}
