import type {
  BrainBlockKind,
  BrainBlockUsage,
  BrainSurface,
  BrainTable,
} from "@/lib/db/schema";

/**
 * What the compiler reads. A structural subset of the database rows, so a
 * caller can pass rows straight in, and so every pure function in this folder
 * can be tested without a database.
 */

export interface BrainProjectSource {
  name: string;
  whatIMake: string;
  audience: string;
  voice: string;
  offers: string;
  doNots: string;
}

export interface BrainPillarSource {
  name: string;
  description: string;
  examples: string[];
}

/** One slice of a `doc` block. */
export interface BrainChunkSource {
  ord: number;
  heading: string;
  text: string;
}

export interface BrainBlockSource {
  id: string;
  title: string;
  kind: BrainBlockKind;
  usage: BrainBlockUsage;
  /** The one line that is always in the prompt. Falls back to a description
   * derived from the block when the creator has not written one. */
  digest: string;
  body: string;
  items: string[];
  rows: BrainTable | null;
  tags: string[];
  sourceLabel: string;
  /** Present for `doc` blocks. Absent elsewhere. */
  chunks?: BrainChunkSource[];
}

export interface BrainSkillSource {
  id: string;
  name: string;
  whenToUse: string;
  instructions: string;
  /** Empty means every surface. */
  surfaces: BrainSurface[];
  enabled: boolean;
}

/** Everything one creator's brain holds, as one request sees it. */
export interface BrainSnapshot {
  project: BrainProjectSource | null;
  pillars: BrainPillarSource[];
  blocks: BrainBlockSource[];
  skills: BrainSkillSource[];
}

/** Which skills and blocks a given prompt loads in full, by index reference. */
export interface BrainSelection {
  skillRefs: string[];
  contextRefs: string[];
  /** How the choice was made, for logging and for the page's disclosure. */
  by: "all" | "rules" | "model";
}

/** What a prompt actually read, in names the creator recognises. */
export interface BrainUsed {
  skills: string[];
  context: string[];
}

export type { BrainSurface, BrainTable };
