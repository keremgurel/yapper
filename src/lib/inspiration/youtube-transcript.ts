/**
 * Keyless YouTube transcript fetch. Pulls the watch page, finds the caption
 * tracks embedded in ytInitialPlayerResponse, then fetches and parses the
 * timedtext payload. Returns null on any failure (no captions, blocked, etc.)
 * so callers can degrade gracefully.
 */

import {
  extractArray,
  parseTimedText,
  pickTrack,
  type CaptionTrack,
} from "./youtube-transcript-parse";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

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
    return parseTimedText(xml);
  } catch {
    return null;
  }
}
