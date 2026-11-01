import { getActiveProject } from "@/lib/db/projects";
import { withPlanLedger } from "../ledger";
import type { StudioPlan } from "./catalog";
import { resolveConfirmation } from "./confirm";
import { executeStudioPlan } from "./execute";
import type { StudioActionContext, StudioNames } from "./executor";
import { namesFrom, readStudioOverview } from "./overview";
import { planStudio } from "./planner";
import { latestPendingExecution } from "./receipts";
import { turnReply } from "./reply";
import { typedDecision } from "./typed-decision";
import type { StudioTurnInput, StudioTurnReply } from "./wire";

/** What the ledger saves for a Studio turn: the plan and the names its
 * confirmation needs, so a retried turn shows the same question. */
interface StudioPlanRecord {
  kind: "studio-plan";
  plan: StudioPlan;
  names: StudioNames;
}

/** Keep only the names the plan's arguments point at. */
function namesFor(plan: StudioPlan, names: StudioNames): StudioNames {
  const ids = new Set(
    plan.actions.flatMap((call) =>
      Object.entries(call.arguments)
        .filter(([key]) => /IDs?$/.test(key))
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === "string"),
    ),
  );
  const pick = (table: Record<string, string>) =>
    Object.fromEntries(Object.entries(table).filter(([id]) => ids.has(id)));
  return {
    ideas: pick(names.ideas),
    views: pick(names.views),
    pillars: pick(names.pillars),
  };
}

/**
 * One Studio turn. A bare yes or no answers the creator's latest confirmation
 * without a model call or a credit. Anything else is planned once under the
 * Chirpy ledger (two credits, idempotent by execution ID), then the plan's
 * actions run on the server, each once, after the ledger has committed: a
 * paid action reserves credits of its own, which the ledger's open
 * transaction would block.
 */
export async function runStudioTurn(
  userId: string,
  request: Request,
  input: StudioTurnInput,
  beforePlanning: () => Promise<void>,
): Promise<StudioTurnReply> {
  const context: StudioActionContext = {
    userId,
    request,
    signal: request.signal,
    timeZone: input.timeZone,
  };
  const decision = typedDecision(input.messages.at(-1)!.content);
  if (decision) {
    const waiting = await latestPendingExecution(userId);
    if (waiting) {
      const answered = await resolveConfirmation(context, waiting, decision);
      if (answered) return answered;
    }
  }

  const project = await getActiveProject(userId);
  const record = await withPlanLedger<
    StudioTurnInput & { projectID: string },
    StudioPlanRecord
  >(userId, { ...input, projectID: project.id }, async () => {
    await beforePlanning();
    const overview = await readStudioOverview(userId, input);
    const plan = await planStudio(input, overview, request.signal);
    return {
      kind: "studio-plan",
      plan,
      names: namesFor(plan, namesFrom(overview)),
    };
  });
  const execution = await executeStudioPlan(
    context,
    project.id,
    input.executionID,
    record.plan,
    record.names,
  );
  return turnReply(input.executionID, record.plan, execution);
}
