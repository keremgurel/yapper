import { beforeEach, describe, expect, it, vi } from "vitest";
import { askIdeaCanvas } from "@/lib/content/operations/canvas-ask";
import { studioPlanIssue } from "../catalog";
import type { StudioActionContext } from "../executor";
import { turnReply } from "../reply";
import { CANVAS_ACTIONS } from "./actions";

vi.mock("@/lib/content/operations/canvas-ask", () => ({
  askIdeaCanvas: vi.fn(),
}));
vi.mock("../ideas/labels", async (original) => ({
  ...(await original<typeof import("../ideas/labels")>()),
  ideaLabels: vi.fn(async (_user: string, ids: string[]) =>
    ids.length ? new Map([[ids[0], "Gym myths"]]) : new Map(),
  ),
}));

const IDEA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
} satisfies StudioActionContext;

describe("canvas plans", () => {
  it("runs a canvas ask alone", () => {
    const edit = {
      action: "studio.ideas.canvasEdit",
      arguments: { ideaID: IDEA, instruction: "tighten the hook" },
    };
    expect(studioPlanIssue({ message: "", actions: [edit] })).toBeNull();
    expect(
      studioPlanIssue({
        message: "",
        actions: [
          edit,
          {
            action: "studio.ideas.setStatus",
            arguments: { ideaIDs: [IDEA], status: "ready" },
          },
        ],
      }),
    ).toMatch(/canvasEdit must run alone/);
  });

  it("needs the creator's words for a capture unless it is from inspiration", () => {
    const capture = (args: Record<string, unknown>) =>
      studioPlanIssue({
        message: "",
        actions: [{ action: "studio.ideas.capture", arguments: args }],
      });
    expect(capture({})).toMatch(/note is required unless fromInspiration/);
    expect(capture({ fromInspiration: true })).toBeNull();
    expect(capture({ note: "gym myths" })).toBeNull();
  });
});

describe("studio.ideas.canvasEdit", () => {
  beforeEach(() => vi.mocked(askIdeaCanvas).mockReset());

  it("goes through the canvas ask and replies with what the writer said", async () => {
    vi.mocked(askIdeaCanvas).mockResolvedValue({
      ok: true,
      value: {
        actions: [
          {
            type: "replace",
            index: 0,
            block: { label: "Hook", kind: "paragraph", text: "Stop." },
          },
        ],
        note: "Cut the hook to one line.",
        balance: 10,
        used: { skills: [], context: [] },
        messages: [],
        document: {
          format: "short",
          title: "Gym myths",
          hooks: [],
          blocks: [],
          script: null,
        },
      },
    });
    const outcome = await CANVAS_ACTIONS["studio.ideas.canvasEdit"].run(
      { ideaID: IDEA, instruction: "tighten the hook", format: "long" },
      context,
    );
    expect(askIdeaCanvas).toHaveBeenCalledWith(
      context.request,
      "user_1",
      { ideaID: IDEA, instruction: "tighten the hook", format: "long" },
      undefined,
    );
    expect(outcome).toEqual({
      summary: "“Gym myths”: Rewrote Hook.",
      reply: "Cut the hook to one line.",
      effects: ["ideaCanvas", "ideas"],
    });
  });

  it("turns a refusal into a sentence and an answer into the reply", async () => {
    vi.mocked(askIdeaCanvas).mockResolvedValueOnce({
      ok: false,
      status: 402,
      error: "insufficient_credits",
    });
    await expect(
      CANVAS_ACTIONS["studio.ideas.canvasEdit"].run(
        { ideaID: IDEA, instruction: "write the script" },
        context,
      ),
    ).rejects.toMatchObject({ code: "insufficient_credits" });

    vi.mocked(askIdeaCanvas).mockResolvedValueOnce({
      ok: true,
      value: {
        actions: [],
        note: "The hook works; the middle drags.",
        balance: 9,
        used: { skills: [], context: [] },
        messages: [],
        document: {
          format: "short",
          title: "Gym myths",
          hooks: [],
          blocks: [],
          script: null,
        },
      },
    });
    const answer = await CANVAS_ACTIONS["studio.ideas.canvasEdit"].run(
      { ideaID: IDEA, instruction: "is the hook strong?" },
      context,
    );
    expect(answer).toMatchObject({
      summary: "",
      reply: "The hook works; the middle drags.",
      effects: ["ideaCanvas"],
    });
  });

  it("puts the writer's reply in place of the planner's sentence", () => {
    const reply = turnReply(
      "33333333-3333-4333-8333-333333333333",
      {
        message: "Tightened the hook.",
        actions: [
          {
            action: "studio.ideas.canvasEdit",
            arguments: { ideaID: IDEA, instruction: "tighten the hook" },
          },
        ],
      },
      {
        receipts: [
          {
            invocationID: "x",
            action: "studio.ideas.canvasEdit",
            status: "done",
            summary: "",
          },
        ],
        pending: [],
        effects: ["ideaCanvas"],
        partial: false,
        replies: ["The hook works; the middle drags."],
      },
    );
    expect(reply).toMatchObject({
      message: "The hook works; the middle drags.",
      tone: "done",
    });
  });
});

describe("studio.ideas.clearThread", () => {
  it("names the idea in its confirmation", () => {
    expect(
      CANVAS_ACTIONS["studio.ideas.clearThread"].describe?.(
        { ideaID: IDEA },
        { ideas: { [IDEA]: "Gym myths" }, views: {}, pillars: {} },
      ),
    ).toBe("Clear Chirpy’s conversation on “Gym myths”");
  });
});
