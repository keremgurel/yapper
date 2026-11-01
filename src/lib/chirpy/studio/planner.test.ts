import { beforeEach, describe, expect, it, vi } from "vitest";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { studioCatalog, studioPlanIssue } from "./catalog";
import { planStudio, type StudioOverview } from "./planner";
import { parseStudioTurnInput, type StudioTurnInput } from "./wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
}));

const IDEA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PILLAR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const input: StudioTurnInput = {
  protocolVersion: 1,
  executionID: "33333333-3333-4333-8333-333333333333",
  surface: "/studio/ideas",
  timeZone: "America/Toronto",
  messages: [{ role: "user", content: "move gym myths to Fitness" }],
};

const overview: StudioOverview = {
  totalIdeas: 1,
  ideas: [
    {
      id: IDEA,
      title: "Gym myths",
      status: "captured",
      formats: ["short"],
      drafted: true,
    },
  ],
  pillars: [{ id: PILLAR, name: "Fitness" }],
  views: [],
  today: {
    date: "2026-10-30",
    weekday: "Friday",
    time: "14:00",
    timeZone: "America/Toronto",
  },
  upcoming: [{ date: "2026-10-30", weekday: "Friday" }],
};

describe("Studio plans", () => {
  it("accepts a catalog action with valid arguments", () => {
    expect(
      studioPlanIssue({
        message: "Filed it.",
        actions: [
          {
            action: "studio.ideas.setPillar",
            arguments: { ideaIDs: [IDEA], pillarID: PILLAR },
          },
        ],
      }),
    ).toBeNull();
  });

  it("refuses client actions, impossible days and a time without a day", () => {
    expect(
      studioPlanIssue({
        message: "",
        actions: [{ action: "editor.export", arguments: {} }],
      }),
    ).toMatch(/not a Studio action/);
    expect(
      studioPlanIssue({
        message: "",
        actions: [
          {
            action: "studio.ideas.schedule",
            arguments: { ideaIDs: [IDEA], date: "2026-02-30" },
          },
        ],
      }),
    ).toMatch(/real day/);
    expect(
      studioPlanIssue({
        message: "",
        actions: [
          {
            action: "studio.ideas.capture",
            arguments: { note: "gym myths", time: "09:00" },
          },
        ],
      }),
    ).toMatch(/time needs a date/);
    expect(
      studioPlanIssue({
        message: "",
        actions: [
          {
            action: "studio.ideas.delete",
            arguments: { ideaIDs: ["not-a-uuid"] },
          },
        ],
      }),
    ).toMatch(/do not match IdeaDeleteInput/);
  });

  it("offers only server actions, deletes marked to confirm", () => {
    const catalog = studioCatalog();
    expect(catalog.every((action) => action.id.startsWith("studio."))).toBe(
      true,
    );
    expect(
      catalog.find((action) => action.id === "studio.ideas.delete"),
    ).toMatchObject({ effect: "destructive", confirm: true });
  });
});

describe("planStudio", () => {
  beforeEach(() => vi.mocked(callSceneModel).mockReset());

  it("keeps the catalog in the cached prefix and the account in the turn", async () => {
    vi.mocked(callSceneModel).mockResolvedValue({
      content: JSON.stringify({
        message: "Filed “Gym myths” under Fitness.",
        actions: [
          {
            action: "studio.ideas.setPillar",
            arguments: { ideaIDs: [IDEA], pillarID: PILLAR },
          },
        ],
      }),
    });
    const plan = await planStudio(input, overview);
    expect(plan.actions[0].action).toBe("studio.ideas.setPillar");
    const request = vi.mocked(callSceneModel).mock.calls[0][0];
    expect(request.reference).toContain("studio.ideas.capture");
    expect(request.reference).not.toContain(IDEA);
    expect(request.user).toContain(IDEA);
    expect(request.user).toContain("Fitness");
    expect(request.promptCacheKey).toMatch(/^chirpy-studio-/);
  });

  it("repairs an invalid reply once with schema-owned feedback", async () => {
    vi.mocked(callSceneModel)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "",
          actions: [
            {
              action: "studio.ideas.schedule",
              arguments: { ideaIDs: [IDEA], date: "2026-13-40" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: "Put it on Friday.",
          actions: [
            {
              action: "studio.ideas.schedule",
              arguments: { ideaIDs: [IDEA], date: "2026-10-30" },
            },
          ],
        }),
      });
    const plan = await planStudio(input, overview);
    expect(plan.actions[0].arguments.date).toBe("2026-10-30");
    expect(vi.mocked(callSceneModel).mock.calls[1][0].user).toMatch(
      /failed validation: studio\.ideas\.schedule: date must be a real day/,
    );
  });
});

describe("parseStudioTurnInput", () => {
  it("accepts a tab's turn and refuses bad zones, surfaces and threads", () => {
    expect(parseStudioTurnInput(input)).toEqual(input);
    expect(parseStudioTurnInput({ ...input, timeZone: "Nowhere/Here" })).toBe(
      null,
    );
    expect(parseStudioTurnInput({ ...input, surface: "/admin" })).toBe(null);
    expect(
      parseStudioTurnInput({
        ...input,
        messages: [{ role: "assistant", content: "Hi" }],
      }),
    ).toBe(null);
    expect(parseStudioTurnInput({ ...input, focus: { ideaID: "nope" } })).toBe(
      null,
    );
  });
});
