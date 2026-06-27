/**
 * Keyless YouTube transcript fetch. Pulls the watch page, finds the caption
 * tracks embedded in ytInitialPlayerResponse, then fetches and parses the
 * timedtext payload. Returns null on any failure (no captions, blocked, etc.)
 * so callers can degrade gracefully.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

/**
 * Extract the balanced JSON array that follows `"key":` in a blob. A plain regex
 * fails because caption track entries contain nested arrays (name.runs), so we
 * bracket-match while respecting string literals.
 */
function extractArray(html: string, key: string): string | null {
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

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const manualEn = tracks.find(
    (t) => t.languageCode?.startsWith("en") && t.kind !== "asr",
  );
  const anyEn = tracks.find((t) => t.languageCode?.startsWith("en"));
  return manualEn ?? anyEn ?? tracks[0];
}

export async function fetchYoutubeTranscript(
  videoId: string,
): Promise<string | null> {
  try {
    // bpctr + CONSENT cookie skip the EU consent interstitial that otherwise
    // returns a page without the embedded player response (and its captions).
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=en&bpctr=9999999999&has_verified=1`,
      {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000",
        },
      },
    );
    if (!res.ok) return null;
    const html = await res.text();

    const arr = extractArray(html, "captionTracks");
    if (!arr) return null;
    const tracks = JSON.parse(arr) as CaptionTrack[];
    const track = pickTrack(tracks);
    if (!track?.baseUrl) return null;

    // The embedded baseUrl is JSON-escaped (& for &); normalize before use.
    const baseUrl = track.baseUrl.replace(/\\u0026/g, "&");
    const xmlRes = await fetch(baseUrl, {
      headers: { "User-Agent": UA },
    });
    if (!xmlRes.ok) return null;
    const xml = await xmlRes.text();

    const lines = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim(),
    );
    const transcript = lines.filter(Boolean).join(" ").replace(/\s+/g, " ");
    return transcript.length > 0 ? transcript : null;
  } catch {
    return null;
  }
}
