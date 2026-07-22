/**
 * Publish a Reel via Instagram's Content Publishing API. Instagram fetches the
 * video from a public URL (it never takes bytes), so the caller passes a
 * presigned R2 URL. Three steps: create a media container, poll until Instagram
 * finishes transcoding it, then publish. Requires a Professional (Business or
 * Creator) account; a personal account 400s at the container step.
 */
const GRAPH = "https://graph.instagram.com/v21.0";

export interface InstagramPostInput {
  accessToken: string;
  igUserId: string;
  videoUrl: string;
  caption?: string;
  /** Public URL of a custom cover image; Instagram fetches it like the video. */
  coverUrl?: string;
}

export interface InstagramPostResult {
  mediaId: string;
  url: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}

async function createContainer(input: InstagramPostInput): Promise<string> {
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    access_token: input.accessToken,
  });
  if (input.caption) body.set("caption", input.caption.slice(0, 2200));
  if (input.coverUrl) body.set("cover_url", input.coverUrl);
  const res = await fetch(`${GRAPH}/${input.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `instagram_container_${res.status}: ${await safeText(res)}`,
    );
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("instagram_no_container_id");
  return json.id;
}

/** Poll the container until Instagram reports FINISHED. Reels transcoding is
 * usually seconds but can take longer, so give it a generous bounded window. */
async function awaitFinished(
  containerId: string,
  accessToken: string,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(3000);
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = (await res.json()) as {
      status_code?: string;
      status?: string;
    };
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR" || json.status_code === "EXPIRED") {
      throw new Error(
        `instagram_processing_${json.status_code}: ${json.status ?? ""}`,
      );
    }
  }
  throw new Error("instagram_processing_timeout");
}

async function publishContainer(
  input: InstagramPostInput,
  containerId: string,
): Promise<string> {
  const res = await fetch(`${GRAPH}/${input.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: input.accessToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`instagram_publish_${res.status}: ${await safeText(res)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("instagram_no_media_id");
  return json.id;
}

async function fetchPermalink(
  mediaId: string,
  accessToken: string,
): Promise<string> {
  const url = new URL(`${GRAPH}/${mediaId}`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  if (!res.ok) return `https://www.instagram.com/reel/${mediaId}/`;
  const json = (await res.json()) as { permalink?: string };
  return json.permalink ?? `https://www.instagram.com/reel/${mediaId}/`;
}

export async function postInstagramReel(
  input: InstagramPostInput,
): Promise<InstagramPostResult> {
  const containerId = await createContainer(input);
  await awaitFinished(containerId, input.accessToken);
  const mediaId = await publishContainer(input, containerId);
  const url = await fetchPermalink(mediaId, input.accessToken);
  return { mediaId, url };
}
