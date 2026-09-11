import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

export interface SampleVideoInput {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date | null;
  durationSec: number | null;
}

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** The video the client picked, as the route trusts it. */
export function parseSampleRequest(
  body: Record<string, unknown>,
): { platform: PublishPlatform; video: SampleVideoInput } | null {
  const platform = body.platform;
  if (
    typeof platform !== "string" ||
    platform === "facebook" ||
    !(publishPlatforms as readonly string[]).includes(platform)
  )
    return null;
  const raw =
    body.video && typeof body.video === "object"
      ? (body.video as Record<string, unknown>)
      : null;
  if (!raw) return null;
  const id = str(raw.id, 120);
  if (!id) return null;
  const url = str(raw.url, 500);
  if (url && !/^https:\/\//i.test(url)) return null;
  const thumbnail = str(raw.thumbnail, 800);
  const publishedAt =
    typeof raw.publishedAt === "string" &&
    !Number.isNaN(Date.parse(raw.publishedAt))
      ? new Date(raw.publishedAt)
      : null;
  const durationSec =
    typeof raw.durationSec === "number" &&
    Number.isFinite(raw.durationSec) &&
    raw.durationSec > 0
      ? raw.durationSec
      : null;
  return {
    platform: platform as PublishPlatform,
    video: {
      id,
      url,
      title: str(raw.title, 200),
      thumbnail: thumbnail && /^https:\/\//i.test(thumbnail) ? thumbnail : null,
      publishedAt,
      durationSec,
    },
  };
}
