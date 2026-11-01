import { record, UUID } from "../protocol";
import type { StudioOpen } from "./poster/prefill";
import {
  parseInspirationFocus,
  type InspirationFocus,
} from "./inspiration/focus";
import { isTimeZone } from "./zoned-time";

/** What a Studio tab sends: the conversation, which tab it is on, and what is
 * open there. The server reads the creator's own data itself; a client never
 * uploads the account. */
export interface StudioTurnInput {
  protocolVersion: 1;
  executionID: string;
  surface: string;
  timeZone: string;
  focus?: { ideaID?: string; inspiration?: InspirationFocus };
  /** False from a Mac build that cannot open a tab from a reply's `open`. */
  canOpen?: false;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/** Studio data a turn changed, so the web caches and the Mac stores that
 * show it reload: `ideas` is the idea list and the calendar, `ideaViews` the
/** Studio data a turn changed, so the web caches and the Mac stores that
 * show it reload: `ideas` is the idea list and the calendar, `ideaViews` the
 * saved views of the Ideas list, `brand` the brand kit, `storage` the
 * storage numbers and stored videos, `automations` the cross-posting rule,
 * `brain` the Essentials, pillars, Knowledge, skills and voice set,
 * `ideaCanvas` an idea's canvas document and its conversation,
 * `posterVideos` Poster's video list and `schedules` the calendar's
 * scheduled posts. */
export type StudioEffect =
  | "ideas"
  | "ideaViews"
  | "brand"
  | "storage"
  | "automations"
  | "brain"
  | "ideaCanvas"
  | "posterVideos"
  | "schedules";

export type StudioReceiptStatus =
  | "done"
  | "failed"
  | "skipped"
  | "canceled"
  | "running";

export interface StudioActionReceipt {
  invocationID: string;
  action: string;
  status: StudioReceiptStatus;
  /** One line for the creator: what changed, or why it did not. */
  summary: string;
}

/** Actions that wait for the creator, run only by /api/chirpy/confirm. */
export interface StudioConfirmation {
  executionID: string;
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  /** For the Mac's text-only thread, which has no buttons. */
  typedHint: string;
}

export interface StudioTurnReply {
  executionID: string;
  message: string;
  tone: "done" | "trouble" | "answer";
  notes: string[];
  results: StudioActionReceipt[];
  confirm?: StudioConfirmation;
  effects: StudioEffect[];
  /** A tab to open with state filled in. Clients that predate it ignore it,
   * and the message still says where to look. */
  open?: StudioOpen;
}

const SURFACE = /^\/studio(?:\/[a-z0-9-]+){0,3}$/;

export function parseStudioTurnInput(raw: unknown): StudioTurnInput | null {
  if (
    !record(raw) ||
    raw.protocolVersion !== 1 ||
    typeof raw.executionID !== "string" ||
    !UUID.test(raw.executionID) ||
    typeof raw.surface !== "string" ||
    !SURFACE.test(raw.surface) ||
    !isTimeZone(raw.timeZone)
  )
    return null;
  let focus: StudioTurnInput["focus"];
  if (raw.focus !== undefined) {
    if (!record(raw.focus)) return null;
    const { ideaID } = raw.focus;
    if (
      ideaID !== undefined &&
      (typeof ideaID !== "string" || !UUID.test(ideaID))
    )
      return null;
    const inspiration =
      raw.focus.inspiration === undefined
        ? undefined
        : parseInspirationFocus(raw.focus.inspiration);
    if (inspiration === null) return null;
    focus =
      ideaID || inspiration
        ? {
            ...(ideaID ? { ideaID } : {}),
            ...(inspiration ? { inspiration } : {}),
          }
        : undefined;
  }
  if (
    !Array.isArray(raw.messages) ||
    !raw.messages.length ||
    raw.messages.length > 20 ||
    !raw.messages.every(
      (item) =>
        record(item) &&
        ["user", "assistant"].includes(item.role as string) &&
        typeof item.content === "string" &&
        item.content.trim().length > 0 &&
        item.content.length <= 6000,
    ) ||
    raw.messages.at(-1).role !== "user"
  )
    return null;
  return {
    protocolVersion: 1,
    executionID: raw.executionID.toLowerCase(),
    surface: raw.surface,
    timeZone: raw.timeZone,
    ...(focus ? { focus } : {}),
    ...(raw.canOpen === false ? { canOpen: false as const } : {}),
    messages: raw.messages.map((item) => ({
      role: item.role as "user" | "assistant",
      content: item.content as string,
    })),
  };
}
