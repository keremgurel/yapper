import { PLATFORMS } from "@/lib/publish/platforms";
import type { OutcomeRow } from "./outcome-rows";

export type OutcomeTone = "sending" | "done" | "waiting" | "failed";

export interface OutcomeHeadline {
  tone: OutcomeTone;
  text: string;
}

const list = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

function names(rows: Pick<OutcomeRow, "platform">[]): string {
  return list.format([
    ...new Set(rows.map((row) => PLATFORMS[row.platform].label)),
  ]);
}

/**
 * The one line that says where a publish stands. A failure outranks a wait,
 * and a wait outranks success, so the line never calls a mixed result done.
 */
export function outcomeHeadline(
  rows: Pick<OutcomeRow, "platform" | "status">[],
  videos: number,
): OutcomeHeadline | null {
  if (!rows.length) return null;
  const oneVideo = videos === 1;
  if (rows.some((row) => row.status === "sending"))
    return {
      tone: "sending",
      text: oneVideo
        ? `Publishing to ${names(rows)}…`
        : `Publishing ${rows.length} posts…`,
    };
  const failed = rows.filter((row) => row.status === "failed");
  if (failed.length)
    return {
      tone: "failed",
      text:
        rows.length === 1
          ? `Couldn’t post to ${names(rows)}`
          : `${failed.length} of ${rows.length} posts failed`,
    };
  if (rows.some((row) => row.status === "pending"))
    return { tone: "waiting", text: "Waiting for confirmation" };
  const posted = rows.filter((row) => row.status === "posted");
  if (!posted.length)
    return { tone: "done", text: "Sent to your TikTok inbox" };
  if (!oneVideo)
    return { tone: "done", text: `All ${rows.length} posts went out` };
  const drafted = rows.some((row) => row.status === "draft");
  return {
    tone: "done",
    text: `Posted to ${names(posted)}${drafted ? " and sent to your TikTok inbox" : ""}`,
  };
}
