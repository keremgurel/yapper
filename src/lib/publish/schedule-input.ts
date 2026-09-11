import { RequestBodyError, readBoundedJson } from "@/lib/http/bounded-body";
import {
  readInstagramPublishRequest,
  readTikTokPublishRequest,
  readYouTubePublishRequest,
} from "./request";
import type { PublishPlatform } from "@/lib/db/schema";

export const SCHEDULE_HORIZON_MS = 90 * 24 * 60 * 60_000;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function scheduleDate(
  value: unknown,
  now = Date.now(),
  requireFuture = true,
): Date {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new RequestBodyError("invalid_body");
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    (requireFuture &&
      (date.getTime() < now + 60_000 ||
        date.getTime() > now + SCHEDULE_HORIZON_MS))
  ) {
    throw new RequestBodyError("invalid_body");
  }
  return date;
}

export function scheduleTimezone(value: unknown): string {
  if (typeof value !== "string" || value.length > 100)
    throw new RequestBodyError("invalid_body");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new RequestBodyError("invalid_body");
  }
  return value;
}

export async function readScheduleInput(
  request: Request,
  requireFuture = true,
) {
  const raw = await readBoundedJson(request, { maxBytes: 128 * 1024 });
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new RequestBodyError("invalid_body");
  const body = raw as Record<string, unknown>;
  if (
    typeof body.requestKey !== "string" ||
    !UUID_PATTERN.test(body.requestKey)
  )
    throw new RequestBodyError("invalid_body");
  const scheduledFor = scheduleDate(
    body.scheduledFor,
    Date.now(),
    requireFuture,
  );
  const timezone = scheduleTimezone(body.timezone);
  if (
    !Array.isArray(body.targets) ||
    body.targets.length < 1 ||
    body.targets.length > 20
  )
    throw new RequestBodyError("invalid_body");
  const targets = [];
  const unique = new Set<string>();
  for (const target of body.targets) {
    if (!target || typeof target !== "object" || Array.isArray(target))
      throw new RequestBodyError("invalid_body");
    const platform = target.platform as PublishPlatform;
    if (
      typeof target.expectedAccountId !== "string" ||
      !target.expectedAccountId.trim() ||
      target.expectedAccountId.length > 200
    )
      throw new RequestBodyError("invalid_body");
    if (!["youtube", "instagram", "tiktok", "facebook"].includes(platform))
      throw new RequestBodyError("invalid_body");
    const read =
      platform === "youtube"
        ? readYouTubePublishRequest
        : platform === "instagram" || platform === "facebook"
          ? readInstagramPublishRequest
          : readTikTokPublishRequest;
    const input = await read(
      new Request("https://schedule.internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target.input),
      }),
    );
    if (Boolean(input.submissionId) === Boolean(input.mediaKey))
      throw new RequestBodyError("invalid_body");
    if (input.submissionId && !UUID_PATTERN.test(input.submissionId))
      throw new RequestBodyError("invalid_body");
    if (input.contentItemId && !UUID_PATTERN.test(input.contentItemId))
      throw new RequestBodyError("invalid_body");
    const identity = `${platform}:${input.submissionId ?? input.mediaKey}`;
    if (unique.has(identity)) throw new RequestBodyError("invalid_body");
    unique.add(identity);
    if (
      platform === "youtube" &&
      (!("title" in input) || !input.title?.trim() || input.title.length > 100)
    )
      throw new RequestBodyError("invalid_body");
    targets.push({
      platform,
      input,
      expectedAccountId: target.expectedAccountId,
    });
  }
  return { requestKey: body.requestKey, scheduledFor, timezone, targets };
}
