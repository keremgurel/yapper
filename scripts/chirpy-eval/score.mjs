import { isDeepStrictEqual } from "node:util";
import { check } from "./predicates.mjs";

/** What the integration test accepted as an honest "that isn't available". */
const REFUSAL =
  "unavailable|not (?:currently )?(?:available|supported)|can.t|cannot|doesn.t support|don.t (?:currently )?have";

/**
 * Score one plan against its case. Returns failure strings; empty is a pass.
 *
 *   expect.actions   exact ordered list of action ids
 *   expect.includes  ids that must appear (others allowed)
 *   expect.forbid    ids that must not appear
 *   expect.clarify   no actions, and a message that asks something
 *   expect.refusal   no actions, and a message saying it is unavailable
 *   expect.message   predicates on the message string
 *   expect.args      predicates on one action's arguments; `action` picks it
 *                    by index or by id (first match), default index 0
 *
 * Every case also gets the generic "no invented IDs" check.
 */
export function scorePlan(testCase, plan, input) {
  if (!plan) return ["no valid plan returned"];
  const expect = testCase.expect ?? {};
  const failures = [];
  const ids = plan.actions.map((call) => call.action);

  if (expect.actions && !isDeepStrictEqual(ids, expect.actions))
    failures.push(
      `actions ${JSON.stringify(ids)} want ${JSON.stringify(expect.actions)}`,
    );
  for (const id of expect.includes ?? [])
    if (!ids.includes(id)) failures.push(`missing action ${id}`);
  for (const id of expect.forbid ?? [])
    if (ids.includes(id)) failures.push(`forbidden action ${id}`);
  if ((expect.clarify || expect.refusal) && ids.length)
    failures.push(`want no actions, got ${JSON.stringify(ids)}`);
  if (expect.clarify && !plan.message.trim())
    failures.push("empty clarification");
  if (expect.refusal)
    failures.push(
      ...check(
        plan.message,
        {
          matches:
            typeof expect.refusal === "string" ? expect.refusal : REFUSAL,
          flags: "i",
        },
        "message",
      ),
    );
  for (const predicate of expect.message ?? [])
    failures.push(...check(plan.message, predicate, "message"));
  for (const { action = 0, ...predicate } of expect.args ?? []) {
    const call =
      typeof action === "number"
        ? plan.actions[action]
        : plan.actions.find((item) => item.action === action);
    if (!call)
      failures.push(`no action ${action} to check ${predicate.pointer ?? ""}`);
    else failures.push(...check(call.arguments, predicate, call.action));
  }
  failures.push(...inventedIds(plan, input));
  return failures;
}

/**
 * Any argument whose key ends in ID or IDs must name something the request
 * actually contained. The validator checks shapes, not existence, so this is
 * the eval's guard against made-up targets. UUIDs compare case-insensitively,
 * as the native app parses them.
 */
export function inventedIds(plan, input) {
  const known = JSON.stringify([input.context, input.messages]).toLowerCase();
  const invented = [];
  const visit = (value, key) => {
    if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) visit(v, k);
    else if (
      typeof value === "string" &&
      /IDs?$/.test(key) &&
      !known.includes(value.toLowerCase())
    )
      invented.push(`invented ${key} ${value}`);
  };
  for (const call of plan.actions) visit(call.arguments, "");
  return invented;
}
