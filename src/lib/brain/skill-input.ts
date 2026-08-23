import type { ProjectSkillInput } from "@/lib/db/project-skills";
import type { SkillCatalogInput } from "@/lib/db/skill-catalog";
import {
  brainSurfaces,
  catalogEntryKinds,
  type BrainSurface,
  type CatalogEntryKind,
} from "@/lib/db/schema";

/**
 * Client payloads turned into safe skill rows.
 *
 * Instructions are prompt text that will be executed on the creator's behalf,
 * so the cap matters more here than it looks: it is the ceiling on how much of
 * every future prompt one skill can occupy. The compiler clamps again on the
 * way in, but a row that cannot be stored at ten thousand characters cannot
 * surprise anyone later either.
 */

const NAME_MAX = 80;
const WHEN_MAX = 200;
const INSTRUCTIONS_MAX = 10_000;
const SLUG_MAX = 60;
const TAGLINE_MAX = 140;
const CATEGORY_MAX = 40;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSurfaces(value: unknown): BrainSurface[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((surface): surface is BrainSurface =>
      (brainSurfaces as readonly string[]).includes(surface as string),
    )
    .filter((surface, index, all) => all.indexOf(surface) === index);
}

export function parseSkillInput(
  body: Record<string, unknown>,
): Partial<ProjectSkillInput> {
  const input: Partial<ProjectSkillInput> = {};
  if (typeof body.name === "string") {
    input.name = body.name.trim().slice(0, NAME_MAX);
  }
  if (typeof body.whenToUse === "string") {
    input.whenToUse = body.whenToUse.trim().slice(0, WHEN_MAX);
  }
  if (typeof body.instructions === "string") {
    input.instructions = body.instructions.slice(0, INSTRUCTIONS_MAX);
  }
  if (Array.isArray(body.surfaces))
    input.surfaces = parseSurfaces(body.surfaces);
  if (typeof body.enabled === "boolean") input.enabled = body.enabled;
  return input;
}

/** A skill being created needs a name; everything else can come later, the same
 * way an empty section is still a section. */
export function parseNewSkill(
  body: Record<string, unknown>,
): ProjectSkillInput | null {
  const input = parseSkillInput(body);
  if (!input.name) return null;
  return { ...input, name: input.name };
}

export function parseCatalogInput(
  body: Record<string, unknown>,
): Partial<SkillCatalogInput> {
  const input: Partial<SkillCatalogInput> = {};
  if (typeof body.slug === "string") {
    const slug = body.slug.trim().toLowerCase().slice(0, SLUG_MAX);
    if (SLUG.test(slug)) input.slug = slug;
  }
  if (
    typeof body.kind === "string" &&
    (catalogEntryKinds as readonly string[]).includes(body.kind)
  ) {
    input.kind = body.kind as CatalogEntryKind;
  }
  if (typeof body.name === "string") {
    input.name = body.name.trim().slice(0, NAME_MAX);
  }
  if (typeof body.tagline === "string") {
    input.tagline = body.tagline.trim().slice(0, TAGLINE_MAX);
  }
  if (typeof body.whenToUse === "string") {
    input.whenToUse = body.whenToUse.trim().slice(0, WHEN_MAX);
  }
  if (typeof body.instructions === "string") {
    input.instructions = body.instructions.slice(0, INSTRUCTIONS_MAX);
  }
  if (Array.isArray(body.surfaces))
    input.surfaces = parseSurfaces(body.surfaces);
  if (typeof body.category === "string") {
    input.category = body.category.trim().slice(0, CATEGORY_MAX);
  }
  if (typeof body.published === "boolean") input.published = body.published;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    input.sortOrder = Math.trunc(body.sortOrder);
  }
  return input;
}

export function parseNewCatalogEntry(
  body: Record<string, unknown>,
): SkillCatalogInput | null {
  const input = parseCatalogInput(body);
  if (!input.slug || !input.name) return null;
  return { ...input, slug: input.slug, name: input.name };
}

/** An explicit order from the client, as a list of ids. */
export function parseSkillOrder(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === "string")
    .slice(0, 200);
  return ids.length ? ids : null;
}
