import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioActionContext } from "../executor";

const mocks = vi.hoisted(() => ({
  getAutomation: vi.fn(),
  listConnections: vi.fn(),
  saveAutomationSettings: vi.fn(),
}));
vi.mock("@/lib/db/automations", () => ({
  getAutomation: mocks.getAutomation,
}));
vi.mock("@/lib/db/publish", () => ({
  listConnections: mocks.listConnections,
}));
vi.mock("@/lib/publish/operations/save-automation", () => ({
  saveAutomationSettings: mocks.saveAutomationSettings,
}));

import { wantsAutomations } from "./reads";
import { updateAutomationAction } from "./update";

const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
} satisfies StudioActionContext;

const rule = {
  version: 3,
  enabled: false,
  settings: {
    destinations: ["youtube", "tiktok"],
    stripHashtags: true,
    reformatForYouTube: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAutomation.mockResolvedValue({ rule, runs: [], schedules: [] });
  mocks.listConnections.mockResolvedValue([
    { platform: "instagram", externalAccountId: "ig_1", status: "active" },
    { platform: "youtube", externalAccountId: "yt_1", status: "active" },
    { platform: "tiktok", externalAccountId: "tt_1", status: "expired" },
  ]);
  mocks.saveAutomationSettings.mockImplementation(async (_user, input) => ({
    ok: true,
    value: { enabled: input.enabled, settings: input.settings },
  }));
});

describe("studio.automations.update", () => {
  it("merges the change into the saved rule and checks the accounts connected now", async () => {
    const outcome = await updateAutomationAction.run(
      { enabled: true, destinations: ["youtube"] },
      context,
    );
    expect(mocks.saveAutomationSettings).toHaveBeenCalledWith("user_1", {
      enabled: true,
      version: 3,
      settings: {
        destinations: ["youtube"],
        stripHashtags: true,
        reformatForYouTube: true,
      },
      expectedAccounts: { instagram: "ig_1", youtube: "yt_1" },
    });
    expect(outcome).toEqual({
      summary: "New Instagram posts now copy to YouTube.",
      effects: ["automations"],
    });
  });

  it("explains a refusal in the creator's words", async () => {
    mocks.saveAutomationSettings.mockResolvedValue({
      ok: false,
      status: 409,
      error: "destination_not_connected",
    });
    await expect(
      updateAutomationAction.run({ enabled: true }, context),
    ).rejects.toMatchObject({
      code: "destination_not_connected",
      sentence:
        "Connect Instagram and every place it copies to in Connections, then ask again.",
    });
  });

  it("says what the confirmation turns on, off or changes", () => {
    const describe = updateAutomationAction.describe!;
    const names = { ideas: {}, views: {}, pillars: {} };
    expect(
      describe({ enabled: true, destinations: ["youtube", "tiktok"] }, names),
    ).toBe(
      "Turn on copying each new Instagram post to YouTube and TikTok, until you turn it off",
    );
    expect(describe({ enabled: false }, names)).toBe(
      "Turn off Instagram cross-posting",
    );
    expect(describe({ stripHashtags: false }, names)).toBe(
      "Keep hashtags in copied captions",
    );
  });

  it("refuses an empty change before reading anything", async () => {
    await expect(updateAutomationAction.run({}, context)).rejects.toMatchObject(
      { code: "bad_request" },
    );
    expect(mocks.getAutomation).not.toHaveBeenCalled();
  });
});

describe("wantsAutomations", () => {
  it.each([
    ["/studio/automations", "turn it off", true],
    ["/studio/ideas", "stop cross-posting to TikTok", true],
    ["/studio/ideas", "make an idea about gym myths", false],
  ])("%s %s", (surface, request, expected) => {
    expect(wantsAutomations(surface, request)).toBe(expected);
  });
});
