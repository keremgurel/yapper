import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeStudioPlan } from "./execute";
import { StudioActionFailure, type StudioActionContext } from "./executor";
import {
  claimInvocation,
  finishInvocation,
  invocationID,
  type StudioInvocation,
} from "./receipts";
import { confirmationFor, turnReply } from "./reply";
import { typedDecision } from "./typed-decision";

const run = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({
  studioExecutor: (id: string) => ({
    run: (input: unknown) => run(id, input),
    describe: () => "Delete “Gym myths”",
  }),
}));
vi.mock("./receipts", async (original) => ({
  ...(await original<typeof import("./receipts")>()),
  claimInvocation: vi.fn(),
  finishInvocation: vi.fn(),
}));

const IDEA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXECUTION = "33333333-3333-4333-8333-333333333333";
const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
} satisfies StudioActionContext;
const names = { ideas: { [IDEA]: "Gym myths" }, views: {}, pillars: {} };

describe("executeStudioPlan", () => {
  beforeEach(() => {
    run.mockReset();
    vi.mocked(claimInvocation).mockReset().mockResolvedValue(null);
    vi.mocked(finishInvocation).mockReset().mockResolvedValue();
  });

  it("runs edits at once and saves deletes to wait for the creator", async () => {
    run.mockResolvedValue({ summary: "Renamed it.", effects: ["ideas"] });
    const execution = await executeStudioPlan(
      context,
      "project",
      EXECUTION,
      {
        message: "Renamed it.",
        actions: [
          {
            action: "studio.ideas.rename",
            arguments: { ideaID: IDEA, title: "Gym myths" },
          },
          { action: "studio.ideas.delete", arguments: { ideaIDs: [IDEA] } },
        ],
      },
      names,
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(execution.receipts).toEqual([
      {
        invocationID: invocationID(EXECUTION, 0),
        action: "studio.ideas.rename",
        status: "done",
        summary: "Renamed it.",
      },
    ]);
    expect(execution.pending).toEqual([
      {
        invocationID: invocationID(EXECUTION, 1),
        action: "studio.ideas.delete",
        label: "Delete “Gym myths”",
      },
    ]);
    expect(execution.effects).toEqual(["ideas"]);
    const saved = vi.mocked(claimInvocation).mock.calls[1][2];
    expect(saved).toMatchObject({ status: "pending", index: 1 });
  });

  it("skips what follows a failure and saves the failure", async () => {
    run.mockRejectedValueOnce(
      new StudioActionFailure("not_found", "I couldn’t find that idea."),
    );
    const plan = {
      message: "Done.",
      actions: [
        {
          action: "studio.ideas.rename" as const,
          arguments: { ideaID: IDEA, title: "A" },
        },
        {
          action: "studio.ideas.unschedule" as const,
          arguments: { ideaIDs: [IDEA] },
        },
      ],
    };
    const execution = await executeStudioPlan(
      context,
      "project",
      EXECUTION,
      plan,
      names,
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(execution.receipts.map((receipt) => receipt.status)).toEqual([
      "failed",
      "skipped",
    ]);
    expect(vi.mocked(finishInvocation).mock.calls[0][1]).toMatchObject({
      status: "failed",
      summary: "I couldn’t find that idea.",
    });
    const reply = turnReply(EXECUTION, plan, execution);
    expect(reply.tone).toBe("trouble");
    expect(reply.message).toMatch(/^I couldn’t find that idea\. I stopped/);
  });

  it("reports a retried action from its receipt instead of running it again", async () => {
    const earlier: StudioInvocation = {
      kind: "studio-action",
      executionID: EXECUTION,
      index: 0,
      action: "studio.ideas.rename",
      arguments: {},
      status: "done",
      summary: "Renamed it.",
      effects: ["ideas"],
    };
    vi.mocked(claimInvocation).mockResolvedValue(earlier);
    const execution = await executeStudioPlan(
      context,
      "project",
      EXECUTION,
      {
        message: "Renamed it.",
        actions: [
          {
            action: "studio.ideas.rename",
            arguments: { ideaID: IDEA, title: "Gym myths" },
          },
        ],
      },
      names,
    );
    expect(run).not.toHaveBeenCalled();
    expect(execution.receipts[0]).toMatchObject({
      status: "done",
      summary: "Renamed it.",
    });
  });
});

describe("replies", () => {
  it("shows the model's sentence only when every change happened", () => {
    const reply = turnReply(
      EXECUTION,
      { message: "Made it and put it on Friday.", actions: [] as never[] },
      { receipts: [], pending: [], effects: [], partial: false },
    );
    expect(reply).toMatchObject({ tone: "answer", notes: [] });
  });

  it("asks one question for a turn's deletes, with a typed answer for the Mac", () => {
    expect(
      confirmationFor(EXECUTION, [
        { invocationID: "a", action: "x", label: "Delete “Gym myths”" },
      ]),
    ).toEqual({
      executionID: EXECUTION,
      question: "Delete “Gym myths”? This can’t be undone.",
      confirmLabel: "Delete",
      typedHint: "Reply yes to delete, or no to keep it.",
    });
    expect(
      confirmationFor(EXECUTION, [
        { invocationID: "a", action: "x", label: "Delete “Gym myths”" },
        { invocationID: "b", action: "y", label: "Delete the “Ready” view" },
      ])?.question,
    ).toBe(
      "Delete “Gym myths” and delete the “Ready” view? This can’t be undone.",
    );
  });

  it("reads a bare yes or no and nothing longer", () => {
    expect(typedDecision("yes")).toBe("confirm");
    expect(typedDecision("Go ahead!")).toBe("confirm");
    expect(typedDecision("no")).toBe("cancel");
    expect(typedDecision("keep it")).toBe("cancel");
    expect(typedDecision("yes and also make another idea")).toBe(null);
  });

  it("derives a stable UUID per action of a turn", () => {
    expect(invocationID(EXECUTION, 0)).toBe(invocationID(EXECUTION, 0));
    expect(invocationID(EXECUTION, 0)).not.toBe(invocationID(EXECUTION, 1));
    expect(invocationID(EXECUTION, 0)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
