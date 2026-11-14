import { readBoundedJson, RequestBodyError } from "@/lib/http/bounded-body";

const MAX_PUBLISH_JSON_BYTES = 16 * 1024;

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError("invalid_body");
  }
  return value as JsonObject;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw new RequestBodyError("invalid_body");
  }
  return value;
}

function common(body: JsonObject) {
  return {
    submissionId: optionalString(body.submissionId, 200),
    mediaKey: optionalString(body.mediaKey, 512),
    contentItemId: optionalString(body.contentItemId, 200),
    thumbnailKey: optionalString(body.thumbnailKey, 512),
  };
}

async function read(request: Request): Promise<JsonObject> {
  return object(
    await readBoundedJson(request, { maxBytes: MAX_PUBLISH_JSON_BYTES }),
  );
}

export async function readYouTubePublishRequest(request: Request) {
  const body = await read(request);
  const title = optionalString(body.title, 300);
  const description = optionalString(body.description, 5_000);
  let tags: string[] | undefined;
  if (body.tags !== undefined) {
    if (
      !Array.isArray(body.tags) ||
      body.tags.length > 50 ||
      body.tags.some((tag) => typeof tag !== "string" || tag.length > 100) ||
      body.tags.reduce(
        (total, tag) => total + (typeof tag === "string" ? tag.length : 0),
        0,
      ) > 500
    ) {
      throw new RequestBodyError("invalid_body");
    }
    tags = body.tags as string[];
  }
  for (const field of [
    "selfDeclaredMadeForKids",
    "containsSyntheticMedia",
    "deferCover",
  ]) {
    if (body[field] !== undefined && typeof body[field] !== "boolean")
      throw new RequestBodyError("invalid_body");
  }
  if (description && new TextEncoder().encode(description).byteLength > 5000)
    throw new RequestBodyError("invalid_body");
  const privacy = body.privacyStatus;
  if (
    privacy !== undefined &&
    privacy !== "private" &&
    privacy !== "unlisted" &&
    privacy !== "public"
  ) {
    throw new RequestBodyError("invalid_body");
  }
  return {
    ...common(body),
    title,
    description,
    tags,
    selfDeclaredMadeForKids: body.selfDeclaredMadeForKids as
      | boolean
      | undefined,
    containsSyntheticMedia: body.containsSyntheticMedia as boolean | undefined,
    privacyStatus: privacy as "private" | "unlisted" | "public" | undefined,
    /** The caller will set the cover in a second request, so this one can
     * answer as soon as the upload lands. */
    deferCover: body.deferCover === true,
  };
}

export async function readYouTubeCoverRequest(request: Request) {
  const body = await read(request);
  const thumbnailKey = optionalString(body.thumbnailKey, 512);
  if (!thumbnailKey) throw new RequestBodyError("invalid_body");
  return { thumbnailKey };
}

export async function readInstagramPublishRequest(request: Request) {
  const body = await read(request);
  return {
    ...common(body),
    caption: optionalString(body.caption, 2_200),
  };
}

export async function readTikTokPublishRequest(request: Request) {
  const body = await read(request);
  return {
    ...common(body),
    caption: optionalString(body.caption, 2_200),
  };
}

export async function readTikTokDirectRequest(request: Request) {
  const body = await read(request);
  return {
    ...common(body),
    caption: optionalString(body.caption, 2200) ?? "",
    settings: body.settings,
  };
}

export async function readFacebookPublishRequest(request: Request) {
  const body = await read(request);
  return {
    ...common(body),
    caption: optionalString(body.caption, 2200),
    expectedAccountId: optionalString(body.expectedAccountId, 200),
  };
}
