import contract from "../../../protocol/app-actions.schema.json";

/**
 * Which of Chirpy's server actions a connector may call. The connector has no
 * action list of its own: it is this filter over the shared contract, so an
 * action added for Chirpy can be offered here by widening the filter and
 * never has to be written twice.
 *
 * Kept narrow on purpose. Actions that spend credits, post to a platform, set
 * up a standing rule or ask the creator to confirm in the app are not offered
 * until someone decides how a connector should handle each.
 */
const OFFERED_PREFIXES = ["studio.styles."];
const OFFERED_EFFECTS: readonly string[] = ["serverEdit"];

export type OfferedAction = (typeof contract)["x-actions"][number];

export function offeredActions(): OfferedAction[] {
  return contract["x-actions"].filter(
    (action) =>
      action.runtime === "server" &&
      OFFERED_PREFIXES.some((prefix) => action.id.startsWith(prefix)) &&
      OFFERED_EFFECTS.includes(action.effect) &&
      !("confirm" in action && action.confirm),
  );
}

/** Tool names allow letters, digits, underscores and hyphens, so dots become underscores. */
export const toolName = (actionID: string) => actionID.replace(/\./g, "_");
