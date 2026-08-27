import { isIP } from "node:net";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captionToTitle } from "./instagram-list";
import { MAX_SERVER_PROCESSED_VIDEO_BYTES } from "@/lib/db/constants";

const GRAPH = "https://graph.instagram.com/v21.0";
export const INSTAGRAM_IMPORT_TIMEOUT_MS = 45_000;

export class InstagramClipTooLargeError extends Error {
  constructor() {
    super("clip_too_large");
    this.name = "InstagramClipTooLargeError";
  }
}

export class InstagramDownloadTimeoutError extends Error {
  constructor() {
    super("download_timeout");
    this.name = "InstagramDownloadTimeoutError";
  }
}

export class InstagramDownloadError extends Error {
  constructor(message = "download_failed") {
    super(message);
    this.name = "InstagramDownloadError";
  }
}

export interface DownloadedInstagramClip {
  filePath: string;
  byteLength: number;
  contentType: string;
  cleanup(): Promise<void>;
}

function assertSafeRemoteUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InstagramDownloadError();
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new InstagramDownloadError();
  }
  const hostname = url.hostname.toLowerCase();
  const isInstagramCdn = ["cdninstagram.com", "fbcdn.net"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!isInstagramCdn) throw new InstagramDownloadError();
  const ipVersion = isIP(hostname);
  const blockedIpv4 =
    ipVersion === 4 &&
    (/^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname));
  const blockedIpv6 =
    ipVersion === 6 &&
    (hostname === "::1" ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd"));
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    blockedIpv4 ||
    blockedIpv6
  ) {
    throw new InstagramDownloadError();
  }
  return url;
}

/** Download an Instagram-owned source under one deadline and a hard byte cap.
 * Redirects are followed manually so every hop is revalidated instead of
 * allowing a provider response to bounce the server into a local address. */
export async function downloadInstagramClip(
  sourceUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<DownloadedInstagramClip> {
  const maxBytes = options.maxBytes ?? MAX_SERVER_PROCESSED_VIDEO_BYTES;
  const timeoutMs = options.timeoutMs ?? INSTAGRAM_IMPORT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let url = assertSafeRemoteUrl(sourceUrl);
    let response: Response | null = null;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await fetchImpl(url, {
        cache: "no-store",
        redirect: "manual",
        signal: combinedSignal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirects === 3) throw new InstagramDownloadError();
      const location = response.headers.get("location");
      if (!location) throw new InstagramDownloadError();
      await response.body?.cancel();
      url = assertSafeRemoteUrl(new URL(location, url).toString());
    }
    if (!response?.ok || !response.body) throw new InstagramDownloadError();

    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (
      contentType &&
      !contentType.startsWith("video/") &&
      contentType !== "application/octet-stream"
    ) {
      await response.body.cancel();
      throw new InstagramDownloadError();
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body.cancel();
      throw new InstagramClipTooLargeError();
    }

    const directory = await mkdtemp(join(tmpdir(), "yapper-instagram-"));
    const filePath = join(directory, "clip.mp4");
    let file;
    try {
      file = await open(filePath, "wx");
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
    const reader = response.body.getReader();
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new InstagramClipTooLargeError();
        }
        let offset = 0;
        while (offset < value.byteLength) {
          const { bytesWritten } = await file.write(
            value,
            offset,
            value.byteLength - offset,
          );
          if (bytesWritten <= 0) throw new InstagramDownloadError();
          offset += bytesWritten;
        }
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      await file.close().catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
    try {
      await file.close();
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
    if (total <= 0) {
      await rm(directory, { recursive: true, force: true });
      throw new InstagramDownloadError();
    }
    return {
      filePath,
      byteLength: total,
      contentType: contentType || "video/mp4",
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    if (timedOut || options.signal?.aborted) {
      throw new InstagramDownloadTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** One of the user's own Instagram videos, as Graph describes it. `mediaUrl` is
 * null when Graph withholds the file, which leaves `permalink` as the only
 * route to it. */
export interface ImportedInstagramMedia {
  mediaUrl: string | null;
  permalink: string;
  title: string;
}

/**
 * Look up one Instagram media by id: its downloadable file URL when Graph
 * offers one, its permalink either way, and a title from its caption. Throws
 * `not_a_video` for photos and carousels, which have no single video file to
 * re-post. The id is trusted only to name the media; the file URL and permalink
 * always come back from Graph under the user's own token, so we never download
 * an attacker-supplied URL.
 */
export async function fetchInstagramMediaForImport(
  accessToken: string,
  mediaId: string,
  signal?: AbortSignal,
): Promise<ImportedInstagramMedia> {
  const url = `${GRAPH}/${encodeURIComponent(
    mediaId,
  )}?fields=media_type,media_url,permalink,caption&access_token=${encodeURIComponent(
    accessToken,
  )}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`instagram_media_${res.status}`);
  const json = (await res.json()) as {
    media_type?: string;
    media_url?: string;
    permalink?: string;
    caption?: string;
  };
  if (json.media_type !== "VIDEO") throw new Error("not_a_video");
  return {
    mediaUrl: json.media_url ?? null,
    permalink: json.permalink ?? "",
    title: captionToTitle(json.caption),
  };
}
