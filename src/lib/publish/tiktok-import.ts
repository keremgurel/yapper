import { fetchBoundedJson, fetchBoundedText } from "@/lib/http/outbound";
import { resolveTikTokImportMedia } from "@/lib/inspiration/apify";

// Every redirect is checked too. No arbitrary download hosts or client URLs.
export const TIKTOK_MEDIA_DOMAINS = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktok.com",
  "byteoversea.com",
  "ibytedtos.com",
  "muscdn.com",
  "api.apify.com",
  "apifyusercontent.com",
] as const;

/** TikTok explicitly verifies ownership for /video/query under this token. */
export async function fetchTikTokMediaForImport(
  accessToken: string,
  mediaId: string,
  signal: AbortSignal,
): Promise<{ url: string; title: string }> {
  const { response, data } = await fetchBoundedJson<{
    data?: {
      videos?: {
        id?: string;
        share_url?: string;
        title?: string;
        video_description?: string;
      }[];
    };
    error?: { code?: string };
  }>(
    "https://open.tiktokapis.com/v2/video/query/?fields=id,title,share_url,video_description",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { video_ids: [mediaId] } }),
    },
    { timeoutMs: 15_000, maxBytes: 128 * 1024, signal },
  );
  if (!response.ok || (data.error?.code && data.error.code !== "ok"))
    throw new Error("tiktok_lookup_failed");
  const video = data.data?.videos?.find((video) => video.id === mediaId);
  if (!video) throw new Error("not_owned");
  const url = new URL(video.share_url ?? "");
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.tiktok.com" ||
    url.username ||
    url.password ||
    !new RegExp(`^/@[^/]+/video/${mediaId}/?$`).test(url.pathname)
  )
    throw new Error("no_source_file");
  url.search = "";
  url.hash = "";
  return {
    url: url.toString(),
    title: (video.title || video.video_description || "TikTok video").slice(
      0,
      300,
    ),
  };
}

export async function resolveTikTokImportSource(
  url: string,
  signal: AbortSignal,
): Promise<string> {
  const result = await resolveTikTokImportMedia(url, signal);
  if (!result.mediaUrl) throw new Error("no_source_file");
  const source = new URL(result.mediaUrl);
  // Apify can redirect KV records to a storage host. Ask it to stream the
  // record directly so download destinations stay on the explicit allowlist.
  if (source.hostname === "api.apify.com") {
    if (
      !/^\/v2\/key-value-stores\/[^/]+\/records\/[^/]+$/.test(source.pathname)
    )
      throw new Error("no_source_file");
    source.searchParams.set("disableRedirect", "true");
  }
  return source.toString();
}

/** Best-effort first-party public-page lookup, without cookies or credentials.
 * Only parse the requested video's embedded JSON; never execute page code. */
export function directTikTokSourceFromHtml(
  html: string,
  id: string,
): string | null {
  for (const script of ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE"]) {
    const match = html.match(
      new RegExp(
        `<script[^>]*id=["']${script}["'][^>]*>([\\s\\S]*?)<\\/script>`,
        "i",
      ),
    );
    if (!match) continue;
    try {
      const data = JSON.parse(match[1]);
      const item =
        script === "SIGI_STATE"
          ? data.ItemModule?.[id]
          : data.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo
              ?.itemStruct;
      if (String(item?.id) !== id || item?.imagePost) continue;
      const source = item.video?.playAddr || item.video?.downloadAddr;
      if (typeof source === "string" && source) return source;
    } catch {
      /* Missing or changed page data falls back to the bounded provider. */
    }
  }
  return null;
}

export async function resolveDirectTikTokSource(
  url: string,
  id: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const { response, text } = await fetchBoundedText(
      url,
      { redirect: "error", cache: "no-store" },
      { timeoutMs: 8_000, maxBytes: 2 * 1024 * 1024, signal },
    );
    return response.ok ? directTikTokSourceFromHtml(text, id) : null;
  } catch {
    return null;
  }
}

/** Never forward the provider credential to TikTok or a redirected CDN. */
export function tiktokDownloadHeaders(url: URL): HeadersInit | undefined {
  if (
    url.hostname === "api.apify.com" &&
    /^\/v2\/key-value-stores\/[^/]+\/records\/[^/]+$/.test(url.pathname) &&
    process.env.APIFY_TOKEN
  ) {
    return { Authorization: `Bearer ${process.env.APIFY_TOKEN}` };
  }
}
export const TIKTOK_PUBLIC_MEDIA_DOMAINS = TIKTOK_MEDIA_DOMAINS.filter(
  (domain) => domain !== "api.apify.com" && domain !== "apifyusercontent.com",
);
