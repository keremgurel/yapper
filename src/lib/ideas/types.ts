/**
 * The Idea bank model. An idea is whatever a creator drops in: a spoken note, a
 * link, or a link with their own take on it. Every idea keeps the creator's
 * EXACT original words untouched, and carries an adaptive AI analysis that can
 * be regenerated without ever losing the original. Ideas start in the bank (an
 * inbox) and get curated into the Content Library when the creator decides to
 * actually shoot them.
 */

/**
 * What kind of idea this is, derived from what the creator provided:
 * - `original`: a voice note or typed thought, no external source.
 * - `semi-original`: an inspiration link PLUS the creator's own added context.
 * - `inspiration`: a link dropped on its own, to study or riff on later.
 */
export type IdeaType = "original" | "semi-original" | "inspiration";

/** Where an idea sits in the pipeline. `bank` is the inbox; the rest mirror the
 * Content Library stages, so curating an idea just moves it out of the bank. */
export type IdeaStage = "bank" | "drafted" | "planned" | "scheduled" | "posted";

/** The resolved details of a dropped link (semi-original / inspiration). */
export interface IdeaSource {
  url: string;
  title?: string;
  /** The reference video's complete spoken transcript, never AI-rewritten. */
  transcript?: string;
  platform?: string;
}

export type IdeaSectionKind = "paragraph" | "bullets" | "steps" | "script";

/**
 * One reference-specific block. Labels are intentionally free-form: an
 * audio-led sketch may need "Joke mechanics" and "Audio beats", while an
 * educational monologue may need "Argument" and "Draft script".
 */
export interface IdeaExpansionSection {
  label: string;
  kind: IdeaSectionKind;
  text?: string;
  items?: string[];
}

/** The AI-built analysis. Fully regenerable; never overwrites the source. */
export interface IdeaExpansion {
  title: string;
  /** Content pillar this belongs to (free-form name), or null if unclassified. */
  pillar: string | null;
  /** The source's actual creative form, not a forced content bucket. */
  format?: string;
  /** A concise read on the reference and the creator's intended adaptation. */
  summary?: string;
  /** Flexible blocks chosen to fit this specific reference. */
  sections?: IdeaExpansionSection[];
  /** Legacy fixed-template fields, retained so old saved ideas still render. */
  hooks?: string[];
  outline?: string[];
  keyPoints?: string[];
  script?: string;
}

export interface Idea {
  id: string;
  type: IdeaType;
  stage: IdeaStage;
  /**
   * The creator's EXACT words, verbatim, immutable. For an original idea this is
   * the voice-note (or typed) transcript; for a semi-original it is the context
   * they added. Never regenerated, never paraphrased. The source of truth.
   */
  originalTranscript: string;
  /** The dropped link and its resolved details, for link-based ideas. */
  source?: IdeaSource;
  /** The AI expansion, present once generated. */
  expansion?: IdeaExpansion;
  pillarId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** The raw material a new idea is created from, before type + expansion. */
export interface IdeaInput {
  /** Spoken (transcribed) or typed words from the creator. */
  transcript?: string;
  /** A dropped inspiration link. */
  url?: string;
  /** Resolved link details, when available. */
  source?: IdeaSource;
}
