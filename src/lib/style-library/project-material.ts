import type { TimedWord } from "./format/content-spec";
import type { AnyStyleDefinition } from "./format/style-definition";

/**
 * What a video brings to any block: its take and its transcript. Blocks never
 * store these. They are handed over at draw time, so a template stays a
 * description of a look and can be laid on any project.
 */
export interface ProjectMaterial {
  take: string | null;
  words: TimedWord[];
}

/** The parts of the material this style has a place for. */
export function materialFor(
  style: AnyStyleDefinition,
  material: ProjectMaterial,
): Record<string, unknown> {
  return {
    ...(style.content.take?.kind === "media" ? { take: material.take } : {}),
    ...(style.content.words?.kind === "words" ? { words: material.words } : {}),
  };
}
