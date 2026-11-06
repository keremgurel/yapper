import type { OperationRefusal } from "@/lib/http/operation-result";
import type { StudioOpen } from "./poster/prefill";
import type { StudioEffect, StudioTurnInput } from "./wire";

/** What an executor gets besides its validated input. */
export interface StudioActionContext {
  userId: string;
  /** The turn's request: the provider spend limit identifies callers by it. */
  request: Request;
  signal?: AbortSignal;
  timeZone: string;
  /** False when the client cannot open a tab filled in (an older Mac build). */
  canOpen?: boolean;
  /** The turn's conversation, so an action can read a paste from it instead
   * of the model copying it into arguments. Absent on a confirmation. */
  messages?: StudioTurnInput["messages"];
  /** What was open when the turn was sent; absent when a confirmation runs. */
  focus?: StudioTurnInput["focus"];
}

export interface ActionOutcome {
  /** One line for the creator, past tense: what actually changed. */
  summary: string;
  effects: StudioEffect[];
  /** Part of the action could not be done, and the summary says which. */
  partial?: boolean;
  /** A tab the client opens with state filled in, such as Poster. */
  open?: StudioOpen;
  /** Writing the creator should read as Chirpy's reply (a canvas answer, a
   * brainstorm), in place of the sentence the planner wrote beforehand. */
  reply?: string;
}

/** Names the planner saw, so a confirmation can say "Delete “Gym myths”"
 * instead of an id. */
export interface StudioNames {
  ideas: Record<string, string>;
  views: Record<string, string>;
  pillars: Record<string, string>;
  logos?: Record<string, string>;
  videos?: Record<string, string>;
  recordings?: Record<string, string>;
  /** Bytes, by video or recording id. */
  sizes?: Record<string, string>;
  /** “Gym myths” on TikTok, for a scheduled post. */
  schedules?: Record<string, string>;
  /** Knowledge sections, skills and voice samples, by id. */
  brain?: Record<string, string>;
}

export interface StudioActionDefinition<Input> {
  run: (input: Input, context: StudioActionContext) => Promise<ActionOutcome>;
  /** The confirmation question's subject, for actions that ask first. */
  describe?: (input: Input, names: StudioNames) => string;
  /** Its own confirm button, the line after the question and the cancel
   * button, over the defaults (Delete, “This can’t be undone.” and Keep it
   * for deletions; Confirm and Cancel otherwise). */
  confirm?: { label: string; note?: string; cancel?: string };
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

/** An action whose result only exists once a tab opens with it refuses, before
 * any charge, on a client that cannot open one. */
export function requireOpen(
  context: StudioActionContext,
  instead: string,
): void {
  if (context.canOpen === false)
    throw new StudioActionFailure(
      "needs_update",
      `This version of the Mac app can’t open Poster for me, so nothing changed. ${instead} Updating Yapper lets me fill it in.`,
    );
}

/**
 * What an action over several items reports: what changed, then why each of
 * the rest did not, with the effects of what changed. It is partial when
 * anything was refused, and a refusal outright when nothing changed, so a
 * receipt never hides a change that did happen.
 */
export function someDone(
  done: string | null,
  refusals: readonly StudioActionFailure[],
  effects: StudioEffect[],
): ActionOutcome {
  if (!done)
    throw (
      refusals[0] ?? new StudioActionFailure("not_found", "Nothing changed.")
    );
  return {
    summary: [done, ...refusals.map((refusal) => refusal.sentence)].join(" "),
    effects,
    ...(refusals.length ? { partial: true } : {}),
  };
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
    generate_failed: `Writing on ${subject} failed. Nothing was charged.`,
    brainstorm_failed: `Writing ${subject} failed, so the credit was refunded.`,
  };
  return new StudioActionFailure(
    refusal.error,
    sentences[refusal.error] ??
      (refusal.status === 429
        ? sentences.rate_limited
        : `I couldn’t change ${subject}.`),
  );
}
