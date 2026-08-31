import type { PillarInput } from "@/lib/db/project-pillars";
import type { ProjectInput } from "@/lib/db/projects";

// Clamps. Generous enough for a creator to describe their account properly,
// bounded so a client cannot stuff megabytes into the row. The AI context block
// truncates further at its own, tighter caps.
const NAME_MAX = 120;
const FIELD_MAX = 2000;
const LINK_MAX = 300;
const LINKS_MAX = 12;
const BRAND_COLORS_MAX = 8;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

const PILLAR_NAME_MAX = 80;
const PILLAR_DESC_MAX = 600;
const PILLAR_EXAMPLE_MAX = 200;
const PILLAR_EXAMPLES_MAX = 5;
const PILLARS_MAX = 24;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" ? v.slice(0, max) : undefined;

/** Parse a client payload into a safe partial project update. Unknown keys are
 * dropped and invalid values ignored, so a partial save never clobbers a field
 * the client did not mean to send. */
export function parseProjectInput(body: Record<string, unknown>): ProjectInput {
  const input: ProjectInput = {};

  const name = str(body.name, NAME_MAX);
  if (name !== undefined) input.name = name;

  const fields = [
    "whatIMake",
    "audience",
    "voice",
    "offers",
    "doNots",
  ] as const;
  for (const key of fields) {
    const value = str(body[key], FIELD_MAX);
    if (value !== undefined) input[key] = value;
  }

  if (Array.isArray(body.links)) {
    input.links = body.links
      .filter((l): l is string => typeof l === "string")
      .map((l) => l.trim().slice(0, LINK_MAX))
      .filter(Boolean)
      .slice(0, LINKS_MAX);
  }

  if (Array.isArray(body.brandColors)) {
    const seen = new Set<string>();
    input.brandColors = body.brandColors
      .flatMap((value) => {
        if (typeof value !== "string") return [];
        const color = value.trim().toUpperCase();
        if (!HEX_COLOR.test(color) || seen.has(color)) return [];
        seen.add(color);
        return [color];
      })
      .slice(0, BRAND_COLORS_MAX);
  }

  return input;
}

/**
 * Parse a pillar list. Returns null when the payload is not an array, so the
 * caller can tell "no pillars key sent" (leave them alone) apart from "an empty
 * array was sent" (the creator deleted them all, which must be honoured).
 *
 * Entries without a usable name are dropped rather than rejected: a half-typed
 * new row should not fail the creator's whole save.
 */
export function parsePillarInput(value: unknown): PillarInput[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const pillars: PillarInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;

    const name = (str(raw.name, PILLAR_NAME_MAX) ?? "").trim();
    if (!name) continue;
    // The DB has a unique index on (project, name); dropping the duplicate here
    // gives the creator their save instead of a 500.
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const examples = Array.isArray(raw.examples)
      ? raw.examples
          .filter((e): e is string => typeof e === "string")
          .map((e) => e.trim().slice(0, PILLAR_EXAMPLE_MAX))
          .filter(Boolean)
          .slice(0, PILLAR_EXAMPLES_MAX)
      : [];

    pillars.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : undefined,
      name,
      description: (str(raw.description, PILLAR_DESC_MAX) ?? "").trim(),
      examples,
    });
    if (pillars.length >= PILLARS_MAX) break;
  }

  return pillars;
}
