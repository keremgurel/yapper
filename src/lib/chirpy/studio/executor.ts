import type { OperationRefusal } from "@/lib/http/operation-result";
import type { StudioEffect } from "./wire";

/** What an executor gets besides its validated input. */
export interface StudioActionContext {
  userId: string;
  /** The turn's request: the provider spend limit identifies callers by it. */
  request: Request;
  signal?: AbortSignal;
  timeZone: string;
}

export interface ActionOutcome {
  /** One line for the creator, past tense: what actually changed. */
  summary: string;
  effects: StudioEffect[];
  /** Part of the action could not be done, and the summary says which. */
  partial?: boolean;
}

/** Names the planner saw, so a confirmation can say "Delete “Gym myths”"
 * instead of an id. */
export interface StudioNames {
  ideas: Record<string, string>;
  views: Record<string, string>;
  pillars: Record<string, string>;
}

export interface StudioActionDefinition<Input> {
  run: (input: Input, context: StudioActionContext) => Promise<ActionOutcome>;
  /** The confirmation question's subject, for actions that ask first. */
  describe?: (input: Input, names: StudioNames) => string;
}

/** A refusal the creator should read, never a stack trace. */
export class StudioActionFailure extends Error {
  constructor(
    readonly code: string,
    readonly sentence: string,
  ) {
    super(code);
  }
}

/** Turn an operation's refusal into a sentence the creator can act on. */
export function failureFrom(
  refusal: OperationRefusal,
  subject: string,
): StudioActionFailure {
  const sentences: Record<string, string> = {
    not_found: `I couldn’t find ${subject}. It may have been deleted.`,
    bad_pillar: "That pillar isn’t one of yours anymore.",
    insufficient_credits: `You don’t have enough credits for ${subject}.`,
    not_entitled: `${subject} needs a plan with AI credits.`,
    no_provider: "Writing isn’t available right now. Nothing was charged.",
    expand_failed: `Writing ${subject} failed, so the credits were refunded.`,
    version_failed: `Writing ${subject} failed, so the credits were refunded.`,
    already_drafted: `${subject} already has a draft, so I left it alone.`,
    lead_format: `That format is the idea’s lead version.`,
    no_source_version: "The version to write from doesn’t exist yet.",
    empty_source_version: "The version to write from is still empty.",
    same_format: "Pick a different format to write from.",
    too_many_views: "You already have 20 views. Delete one first.",
    bad_view: "That view needs a name.",
    rate_limited: "That’s a lot of AI work in a short time. Try again soon.",
  };
  return new StudioActionFailure(
    refusal.error,
    sentences[refusal.error] ??
      (refusal.status === 429
        ? sentences.rate_limited
        : `I couldn’t change ${subject}.`),
  );
}
