import { fetchBoundedJson, OutboundHttpError } from "@/lib/http/outbound";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";

const GRAPH = "https://graph.instagram.com/v21.0";
const CONTROL_RESPONSE_BYTES = 256 * 1024;

export interface InstagramPostInput {
  accessToken: string;
  igUserId: string;
  videoUrl: string;
  caption?: string;
  coverUrl?: string;
}

export interface InstagramPostResult {
  mediaId: string;
  url: string;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new OutboundHttpError("aborted", { cause: signal.reason }));
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      reject(new OutboundHttpError("aborted", { cause: signal.reason }));
    }
    signal.addEventListener("abort", aborted, { once: true });
  });
}

async function createContainer(
  input: InstagramPostInput,
  workflow: PublishWorkflow,
): Promise<string> {
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    access_token: input.accessToken,
  });
  if (input.caption) body.set("caption", input.caption.slice(0, 2200));
  if (input.coverUrl) body.set("cover_url", input.coverUrl);
  const { response, data } = await fetchBoundedJson<{ id?: unknown }>(
    `${GRAPH}/${input.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    {
      timeoutMs: remainingPublishMs(workflow, 20_000),
      maxBytes: CONTROL_RESPONSE_BYTES,
      signal: workflow.signal,
    },
  );
  if (!response.ok) throw new Error(`instagram_container_${response.status}`);
  if (typeof data.id !== "string" || !data.id) {
    throw new Error("instagram_no_container_id");
  }
  return data.id;
}

async function awaitFinished(
  containerId: string,
  accessToken: string,
  workflow: PublishWorkflow,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(Math.min(3_000, remainingPublishMs(workflow)), workflow.signal);
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", accessToken);
    const { response, data } = await fetchBoundedJson<{
      status_code?: unknown;
      status?: unknown;
    }>(
      url,
      {},
      {
        timeoutMs: remainingPublishMs(workflow, 15_000),
        maxBytes: CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
    if (!response.ok) continue;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(
        `instagram_processing_${data.status_code}: ${typeof data.status === "string" ? data.status.slice(0, 300) : ""}`,
      );
    }
  }
  throw new Error("instagram_processing_timeout");
}

async function publishContainer(
  input: InstagramPostInput,
  containerId: string,
  workflow: PublishWorkflow,
): Promise<string> {
  let result;
  try {
    result = await fetchBoundedJson<{ id?: unknown }>(
      `${GRAPH}/${input.igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: input.accessToken,
        }),
      },
      {
        timeoutMs: remainingPublishMs(workflow, 20_000),
        maxBytes: CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
  } catch (error) {
    throw new PublishOutcomeUnknownError("instagram", error);
  }
  const { response, data } = result;
  if (!response.ok) {
    if (response.status >= 500) {
      throw new PublishOutcomeUnknownError("instagram");
    }
    throw new Error(`instagram_publish_${response.status}`);
  }
  if (typeof data.id !== "string" || !data.id) {
    throw new PublishOutcomeUnknownError("instagram");
  }
  return data.id;
}

async function fetchPermalink(
  mediaId: string,
  accessToken: string,
  workflow: PublishWorkflow,
): Promise<string> {
  // A Graph media ID is not a public Reel shortcode, so fabricating a URL from
  // it produces a broken link. Empty means "published, permalink unavailable."
  const fallback = "";
  try {
    const url = new URL(`${GRAPH}/${mediaId}`);
    url.searchParams.set("fields", "permalink");
    url.searchParams.set("access_token", accessToken);
    const { response, data } = await fetchBoundedJson<{ permalink?: unknown }>(
      url,
      {},
      {
        timeoutMs: remainingPublishMs(workflow, 10_000),
        maxBytes: CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
    return response.ok && typeof data.permalink === "string"
      ? data.permalink
      : fallback;
  } catch {
    // Publishing is irreversible and already succeeded. Metadata lookup must
    // never downgrade the durable post to a failed/retryable job.
    return fallback;
  }
}

export async function postInstagramReel(
  input: InstagramPostInput,
  workflow: PublishWorkflow,
): Promise<InstagramPostResult> {
  const containerId = await createContainer(input, workflow);
  await awaitFinished(containerId, input.accessToken, workflow);
  const mediaId = await publishContainer(input, containerId, workflow);
  const url = await fetchPermalink(mediaId, input.accessToken, workflow);
  return { mediaId, url };
}
