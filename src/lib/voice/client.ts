import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import type { VoiceSampleView } from "@/lib/voice/sample-view";

export type VoiceSample = VoiceSampleView;

export class VoiceRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function read<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new VoiceRequestError(
      typeof body.error === "string" ? body.error : `voice_${res.status}`,
    );
  }
  return body as T;
}

export async function fetchVoiceSamples(): Promise<VoiceSample[]> {
  const data = await read<{ samples?: VoiceSample[] }>(
    await fetch("/api/brain/voice", { cache: "no-store" }),
  );
  return data.samples ?? [];
}

export async function addVoiceSample(
  platform: PublishPlatform,
  video: PlatformVideo,
): Promise<{ sample: VoiceSample; charged: number; balance: number }> {
  return read(
    await fetch("/api/brain/voice/samples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        video: {
          id: video.id,
          url: video.url,
          title: video.title,
          thumbnail: video.thumbnail,
          publishedAt: video.publishedAt,
          durationSec: video.durationSec ?? null,
        },
      }),
    }),
  );
}

export async function removeVoiceSample(id: string): Promise<void> {
  await read(
    await fetch(`/api/brain/voice/samples/${id}`, { method: "DELETE" }),
  );
}

export async function deriveVoiceProfile(): Promise<{
  applied: Record<string, string>;
  samples: number;
}> {
  return read(await fetch("/api/brain/voice/derive", { method: "POST" }));
}
