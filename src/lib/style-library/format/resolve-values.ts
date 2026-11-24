import { paletteFor, type ScenePalette } from "../../studio/scene/scene-colors";
import type { ContentSpecs, ContentValues } from "./content-spec";
import { coerceValue } from "./coerce-value";
import type { OptionSpecs, OptionValues } from "./option-spec";

/** Full values for a style, plus a note for everything that was changed or ignored. */
export interface Resolved<V> {
  values: V;
  notes: string[];
}

type Specs = OptionSpecs | ContentSpecs;

function resolve(
  specs: Specs,
  input: unknown,
  what: string,
  palette: ScenePalette,
): Resolved<Record<string, unknown>> {
  const sent =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const notes: string[] = [];
  const values: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs)) {
    values[key] = coerceValue(spec, sent[key], { key, notes, palette });
  }
  for (const key of Object.keys(sent)) {
    if (!(key in specs)) notes.push(`Ignored an unknown ${what} '${key}'.`);
  }
  return { values, notes };
}

/**
 * A style's options with the defaults filled in. `palette` is the brand kit
 * the colour tokens resolve against; without one they use the house palette.
 */
export function resolveOptions<S extends OptionSpecs>(
  specs: S,
  input?: unknown,
  palette: ScenePalette = paletteFor([]),
): Resolved<OptionValues<S>> {
  return resolve(specs, input, "option", palette) as Resolved<OptionValues<S>>;
}

/** A style's content with the defaults filled in. */
export function resolveContent<S extends ContentSpecs>(
  specs: S,
  input?: unknown,
): Resolved<ContentValues<S>> {
  return resolve(specs, input, "content field", paletteFor([])) as Resolved<
    ContentValues<S>
  >;
}
