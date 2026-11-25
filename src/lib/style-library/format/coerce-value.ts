import {
  isSceneBrandToken,
  normalizeSceneColor,
  type ScenePalette,
} from "../../studio/scene/scene-colors";
import type { ContentSpec, TimedWord, TimeWindow } from "./content-spec";
import type { OptionSpec } from "./option-spec";

/**
 * Turns one untrusted value into what its spec allows. Same policy as the
 * scene validator: clamp where that is harmless, fall back to the default
 * where it is not, and say so in a note instead of failing the whole apply.
 */

const MAX_WORDS = 6000;
const MAX_WINDOWS = 200;
const MAX_MEDIA_URL = 2048;
/** A small picture carried in the value itself, such as the library's drawn stand-ins. */
const MAX_INLINE_IMAGE = 16 * 1024;

const mediaFits = (value: string) =>
  value.length > 0 &&
  value.length <=
    (value.startsWith("data:image/") ? MAX_INLINE_IMAGE : MAX_MEDIA_URL);

type Spec = OptionSpec | ContentSpec;

export interface CoerceContext {
  key: string;
  notes: string[];
  palette: ScenePalette;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function words(raw: unknown): TimedWord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (w): w is TimedWord =>
        isRecord(w) &&
        typeof w.text === "string" &&
        finite(w.start) &&
        finite(w.end) &&
        w.end >= w.start,
    )
    .slice(0, MAX_WORDS)
    .map(({ text, start, end }) => ({ text, start, end }));
}

function windows(raw: unknown): TimeWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (w): w is TimeWindow =>
        isRecord(w) && finite(w.from) && finite(w.to) && w.to > w.from,
    )
    .slice(0, MAX_WINDOWS)
    .map(({ from, to }) => ({ from, to }));
}

function color(raw: unknown, palette: ScenePalette): string | null {
  const normal = normalizeSceneColor(raw);
  if (normal === null) return null;
  if (!isSceneBrandToken(normal)) return normal;
  return palette[normal.slice("brand.".length) as keyof ScenePalette];
}

/** The value to use for `spec`, given what the caller sent (`undefined` means "not sent"). */
export function coerceValue(
  spec: Spec,
  raw: unknown,
  { key, notes, palette }: CoerceContext,
): unknown {
  if (spec.kind === "words") return words(raw);
  if (spec.kind === "windows") return windows(raw);

  const fallback = (reason: string) => {
    if (raw !== undefined)
      notes.push(`Kept the default for '${key}': ${reason}.`);
    return spec.kind === "color"
      ? (color(spec.default, palette) ?? spec.default)
      : spec.default;
  };

  switch (spec.kind) {
    case "number": {
      if (!finite(raw)) return fallback("it needs a number");
      const clamped = Math.min(spec.max, Math.max(spec.min, raw));
      if (clamped !== raw) {
        notes.push(
          `Moved '${key}' from ${raw} to ${clamped}, the nearest allowed value.`,
        );
      }
      return clamped;
    }
    case "enum":
      return spec.choices.some((choice) => choice.value === raw)
        ? raw
        : fallback(
            `it takes one of ${spec.choices.map((choice) => choice.value).join(", ")}`,
          );
    case "color":
      return (
        color(raw, palette) ??
        fallback("it needs a hex colour or a brand token")
      );
    case "boolean":
      return typeof raw === "boolean"
        ? raw
        : fallback("it needs true or false");
    case "text":
      return typeof raw === "string"
        ? raw.slice(0, spec.maxLength)
        : fallback("it needs text");
    case "media":
      if (raw === null) return null;
      return typeof raw === "string" && mediaFits(raw)
        ? raw
        : fallback("it needs a media URL");
  }
}
