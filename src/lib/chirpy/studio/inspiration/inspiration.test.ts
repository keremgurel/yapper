import { beforeEach, describe, expect, it, vi } from "vitest";
import { brainstormClip } from "@/lib/content/operations/brainstorm";
import { captureIdea } from "@/lib/ideas/operations/capture";
import type { StudioActionContext } from "../executor";
import { captureAction } from "../ideas/capture";
import { studioRequest, type StudioOverview } from "../planner";
import { parseStudioTurnInput, type StudioTurnInput } from "../wire";
import { brainstormAction } from "./brainstorm";

vi.mock("@/lib/content/operations/brainstorm", () => ({
  brainstormClip: vi.fn(),
}));
vi.mock("@/lib/ideas/operations/capture", () => ({ captureIdea: vi.fn() }));
vi.mock("@/lib/ideas/operations/draft", () => ({ draftSavedIdea: vi.fn() }));
vi.mock("@/lib/content/operations/update-item", () => ({
  updateOwnContentItem: vi.fn(),
}));

const CLIP = {
  url: "https://www.youtube.com/watch?v=abc",
  title: "Why your squat stalls",
  platform: "youtube",
  author: "Strength Lab",
  note: "use for the leg day series",
  transcript: "Most lifters stall because...",
};
const input: StudioTurnInput = {
  protocolVersion: 1,
  executionID: "33333333-3333-4333-8333-333333333333",
  surface: "/studio/inspiration",
  timeZone: "America/Toronto",
  focus: { inspiration: CLIP },
  messages: [{ role: "user", content: "make an idea from this" }],
};
const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
  focus: { inspiration: CLIP },
} satisfies StudioActionContext;

describe("the open inspiration item", () => {
  it("rides on the turn, bounded, and refuses a malformed one", () => {
    expect(parseStudioTurnInput(input)).toEqual(input);
    expect(
      parseStudioTurnInput({
        ...input,
        focus: { inspiration: { ...CLIP, transcript: "x".repeat(20_000) } },
      })?.focus?.inspiration?.transcript,
    ).toHaveLength(12_000);
    expect(
      parseStudioTurnInput({
        ...input,
        focus: { inspiration: { ...CLIP, url: "javascript:alert(1)" } },
      }),
    ).toBeNull();
    expect(
      parseStudioTurnInput({ ...input, focus: { inspiration: { url: "x" } } }),
    ).toBeNull();
  });

  it("reaches the planner as a name, without its transcript", () => {
    const overview = {
      totalIdeas: 0,
      ideas: [],
      pillars: [],
      views: [],
      today: {
        date: "2026-10-30",
        weekday: "Friday",
        time: "14:00",
        timeZone: "America/Toronto",
      },
      upcoming: [],
    } satisfies StudioOverview;
    const request = JSON.parse(studioRequest(input, overview));
    expect(request.focus.inspiration).toEqual({
      title: CLIP.title,
      author: CLIP.author,
      platform: CLIP.platform,
      note: CLIP.note,
    });
    expect(JSON.stringify(request)).not.toContain("Most lifters");
  });
});

describe("making an idea from it", () => {
  beforeEach(() => vi.mocked(captureIdea).mockReset());

  it("saves the item as the idea's source, with no words of the model's", async () => {
    vi.mocked(captureIdea).mockResolvedValue({
      ok: true,
      value: {
        id: "idea",
        title: CLIP.title,
        originalNote: "",
        scheduledFor: null,
      } as never,
    });
    const outcome = await captureAction.run(
      { fromInspiration: true, draft: false },
      context,
    );
    expect(captureIdea).toHaveBeenCalledWith("user_1", {
      originalNote: "",
      ideaType: "inspiration",
      leadFormat: "short",
      title: CLIP.title,
      sourceUrl: CLIP.url,
      sourceTitle: CLIP.title,
      sourcePlatform: CLIP.platform,
      sourceTranscript: CLIP.transcript,
    });
    expect(outcome.summary).toBe(`Created “${CLIP.title}”.`);
  });

  it("asks for the card when none is open", async () => {
    await expect(
      captureAction.run(
        { fromInspiration: true },
        { ...context, focus: undefined },
      ),
    ).rejects.toMatchObject({ code: "no_inspiration" });
    expect(captureIdea).not.toHaveBeenCalled();
  });
});

describe("studio.inspiration.brainstorm", () => {
  it("talks the item through and replies with the writing", async () => {
    vi.mocked(brainstormClip).mockResolvedValue({
      ok: true,
      value: {
        reply: "## Why\n**The hook** works because…",
        balance: 4,
        used: { skills: [], context: [] },
      },
    });
    const outcome = await brainstormAction.run(
      { ask: "three angles" },
      context,
    );
    expect(vi.mocked(brainstormClip).mock.calls[0][2]).toEqual({
      messages: [
        {
          role: "user",
          content: `three angles\n\nMy note on this clip: ${CLIP.note}`,
        },
      ],
      clip: {
        title: CLIP.title,
        url: CLIP.url,
        platform: CLIP.platform,
        creator: CLIP.author,
        transcript: CLIP.transcript,
      },
      pillars: [],
    });
    expect(outcome).toEqual({
      summary: `Brainstormed on “${CLIP.title}”.`,
      reply: "Why\nThe hook works because…",
      effects: [],
    });
  });
});
