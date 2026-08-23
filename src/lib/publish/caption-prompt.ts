import { captionSpec } from "@/lib/publish/caption-specs";
import type { PublishPlatform } from "@/lib/db/schema";

/** Everything known about the video, so the caption describes THIS one. */
export interface CaptionInput {
  /** The creator's compiled standing context (audience, voice, offers, never-say). */
  context?: string;
  title: string;
  /** The opening line of the video itself, which the caption should not repeat. */
  hook?: string;
  /** What is actually said on camera. The single most useful input. */
  script?: string;
  /** The creator's own words about the idea, which outrank any summary. */
  originalNote?: string;
  pillar?: string;
  platforms: PublishPlatform[];
  /** Recent real captions per platform, present only when matching style. */
  styleSamples?: Partial<Record<PublishPlatform, string[]>>;
}

export interface PlatformCaption {
  platform: PublishPlatform;
  /** Empty for platforms with no title field. */
  title: string;
  body: string;
  hashtags: string[];
}

const SCRIPT_MAX = 4000;
const NOTE_MAX = 1500;

/**
 * Build the messages for one call that writes every requested platform at once.
 *
 * One call rather than one per platform, for a reason beyond cost: the captions
 * should be the same idea shaped three ways, and independent calls drift into
 * three different angles on the same video.
 */
export function buildCaptionMessages(input: CaptionInput): {
  system: string;
  user: string;
} {
  const platforms = input.platforms.length ? input.platforms : ["youtube"];
  const specs = platforms.map((p) => captionSpec(p as PublishPlatform));

  const shape = specs
    .map((spec) => {
      const fields = [
        `"platform":"${spec.platform}"`,
        spec.hasTitle ? `"title":"<= ${spec.titleMax} chars"` : `"title":""`,
        `"body":"<= ${spec.bodyMax} chars"`,
        `"hashtags":["without the # sign"]`,
      ].join(",");
      return `{${fields}}`;
    })
    .join(",");

  const rules = specs
    .map(
      (spec) =>
        `- ${spec.platform} (${spec.label}): ${spec.guidance} The first ` +
        `${spec.visibleChars} characters are all a scroller sees, so they have ` +
        `to carry it. ${spec.hashtags.min} to ${spec.hashtags.max} hashtags.`,
    )
    .join("\n");

  const system =
    "You write social captions for a specific creator's own video. Return " +
    "STRICT JSON only, no prose or code fences:\n" +
    `{"captions":[${shape}]}\n\n` +
    "Per platform:\n" +
    rules +
    "\n\nRules:\n" +
    "- Write about what is actually IN this video, using the script. Never " +
    "invent a fact, a number, a result or a story that is not there.\n" +
    "- Do not restate the video's own opening line; the caption sits beside " +
    "the video, it does not narrate it.\n" +
    "- Each platform gets its own wording. Returning the same sentences under " +
    "different platforms is a failure.\n" +
    "- Plain spoken language. No 'unlock', no 'dive in', no 'game changer', " +
    "no emoji unless the creator's own samples use them.\n" +
    "- Hashtags go in the hashtags array only, never inside the body.\n" +
    "- Output JSON and nothing else." +
    (input.context ?? "");

  const parts: string[] = [`Video title: ${input.title}`];
  if (input.pillar) parts.push(`Content pillar: ${input.pillar}`);
  if (input.hook?.trim()) {
    parts.push(`The video opens with (do not repeat): ${input.hook.trim()}`);
  }
  if (input.originalNote?.trim()) {
    parts.push(
      `The creator's own words about the idea:\n${input.originalNote.trim().slice(0, NOTE_MAX)}`,
    );
  }
  if (input.script?.trim()) {
    parts.push(
      `What is said on camera:\n${input.script.trim().slice(0, SCRIPT_MAX)}`,
    );
  }

  specs.forEach((spec) => {
    const samples = (input.styleSamples?.[spec.platform] ?? [])
      .filter(Boolean)
      .slice(0, 8);
    if (!samples.length) return;
    parts.push(
      `The creator's recent ${spec.label} captions, match this voice and format:\n- ${samples.join("\n- ")}`,
    );
  });

  return { system, user: `${parts.join("\n\n")}\n\nWrite the captions.` };
}

// Trimmed before the hash is stripped, not after: models routinely return
// " #tag ", and anchoring on a leading space leaves the hash in place, which
// then double-hashes wherever the UI renders it.
const stripHash = (tag: string) => tag.trim().replace(/^#+/, "").trim();

/**
 * Parse and clamp the model's captions against untrusted output.
 *
 * Clamping matters because the platforms reject over-length fields outright: a
 * YouTube title past 100 characters fails the upload rather than being trimmed
 * for us. Truncation cuts at a word boundary where it can, since a caption
 * severed mid-word reads as broken rather than as shortened.
 *
 * Throws when nothing usable came back, so a paid caller is not billed for an
 * empty result.
 */
export function parseCaptions(
  content: string,
  platforms: PublishPlatform[],
): PlatformCaption[] {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("caption_unparseable");

  let raw: { captions?: unknown };
  try {
    raw = JSON.parse(content.slice(start, end + 1)) as { captions?: unknown };
  } catch {
    throw new Error("caption_unparseable");
  }

  const wanted = new Set<string>(platforms);
  const byPlatform = new Map<PublishPlatform, PlatformCaption>();

  if (Array.isArray(raw.captions)) {
    for (const entry of raw.captions) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      const platform = typeof value.platform === "string" ? value.platform : "";
      if (!wanted.has(platform)) continue;
      const spec = captionSpec(platform as PublishPlatform);

      const title = spec.hasTitle ? clamp(str(value.title), spec.titleMax) : "";
      const body = clamp(str(value.body), spec.bodyMax);
      const hashtags = Array.isArray(value.hashtags)
        ? value.hashtags
            .filter((t): t is string => typeof t === "string")
            .map(stripHash)
            .filter(Boolean)
            .filter((t, i, all) => all.indexOf(t) === i)
            .slice(0, spec.hashtags.max)
        : [];

      if (!title && !body) continue;
      byPlatform.set(spec.platform, {
        platform: spec.platform,
        title,
        body,
        hashtags,
      });
    }
  }

  const captions = platforms
    .map((platform) => byPlatform.get(platform))
    .filter((caption): caption is PlatformCaption => Boolean(caption));

  if (!captions.length) throw new Error("caption_empty");
  return captions;
}

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Trim to a length the platform accepts, preferring the last word boundary so
 * the result reads as shortened rather than severed. */
function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Only honour the boundary if it is not throwing away most of the text.
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
