import { expect, it } from "vitest";
import { automationCopy, readAutomationInput } from "./automation-input";
import { DEFAULT_AUTOMATION_SETTINGS as settings } from "./automation-types";
const request = (body: unknown) =>
  new Request("https://test/automation", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("allows a paused setup with no connected accounts but requires explicit accounts before enabling", async () => {
  expect(
    (
      await readAutomationInput(
        request({ version: 0, enabled: false, settings }),
      )
    ).enabled,
  ).toBe(false);
  await expect(
    readAutomationInput(request({ version: 0, enabled: true, settings })),
  ).rejects.toThrow();
  expect(
    (
      await readAutomationInput(
        request({
          version: 0,
          enabled: true,
          settings,
          expectedAccounts: { instagram: "ig", youtube: "yt", tiktok: "tt" },
        }),
      )
    ).expectedAccounts.youtube,
  ).toBe("yt");
});
it("requires settings with supported destinations, real booleans and a version", async () => {
  for (const body of [
    { version: 0, enabled: "false", settings },
    {
      version: 0,
      enabled: false,
      settings: { ...settings, destinations: ["instagram"] },
    },
    {
      version: 0,
      enabled: false,
      settings: { ...settings, stripHashtags: "false" },
    },
    { version: -1, enabled: false, settings },
  ])
    await expect(readAutomationInput(request(body))).rejects.toThrow();
});
it("preserves the caption while stripping unicode hashtags and shaping YouTube copy", () => {
  expect(
    automationCopy(
      "An opening line #creator\nThe full story #İstanbul #日本語",
      settings,
    ),
  ).toEqual({
    title: "An opening line",
    description: "An opening line\nThe full story",
  });
  expect(
    automationCopy("Keep #tags\nSecond line", {
      ...settings,
      stripHashtags: false,
      reformatForYouTube: false,
    }).title,
  ).toBe("Keep #tags Second line");
  expect(automationCopy("#tags", settings).title).toBe("New video");
  expect(automationCopy("a".repeat(6000), settings).description).toHaveLength(
    5000,
  );
  expect(automationCopy("a".repeat(6000), settings).title).toHaveLength(100);
});
