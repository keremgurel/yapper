import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { canUsePremium } from "@/lib/billing/gate";
import {
  getAutomation,
  saveAutomationRule,
  type AutomationRule,
} from "@/lib/db/automations";
import { getConnectionRow } from "@/lib/db/publish";
import { GET, PUT } from "./route";
import { DEFAULT_AUTOMATION_SETTINGS as settings } from "@/lib/publish/automation-types";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing/gate", () => ({ canUsePremium: vi.fn() }));
vi.mock("@/lib/db/automations", () => ({
  getAutomation: vi.fn(),
  saveAutomationRule: vi.fn(),
  AutomationConflict: class extends Error {},
}));
vi.mock("@/lib/db/publish", () => ({ getConnectionRow: vi.fn() }));
vi.mock("@/lib/db/users", () => ({ ensureUser: vi.fn() }));
const request = (enabled = true) =>
  new Request("https://test/automations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled,
      version: 0,
      settings,
      expectedAccounts: { instagram: "ig", youtube: "yt", tiktok: "tt" },
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "1");
  vi.stubEnv("STUDIO_AUTOMATIONS_ENABLED", "1");
  vi.stubEnv("CRON_SECRET", "test-key");
  vi.mocked(auth).mockResolvedValue({ userId: "user_test" } as Awaited<
    ReturnType<typeof auth>
  >);
  vi.mocked(canUsePremium).mockResolvedValue(true);
  vi.mocked(getAutomation).mockResolvedValue({
    rule: null,
    runs: [],
    schedules: [],
  });
  vi.mocked(getConnectionRow).mockImplementation(
    async (_user, platform) =>
      ({
        externalAccountId: { instagram: "ig", youtube: "yt", tiktok: "tt" }[
          platform
        ],
        status: "active",
        handle: platform,
      }) as Awaited<ReturnType<typeof getConnectionRow>>,
  );
  vi.mocked(saveAutomationRule).mockImplementation(
    async (_user, value) =>
      ({
        ...value,
        id: "rule",
        userId: "user_test",
        version: 1,
        enabledAt: new Date(),
        lastCheckedAt: null,
        error: null,
      }) as AutomationRule,
  );
});
afterEach(() => vi.unstubAllEnvs());
it("requires authentication before reading or saving a rule", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<
    ReturnType<typeof auth>
  >);
  expect((await GET()).status).toBe(401);
  expect((await PUT(request())).status).toBe(401);
  expect(saveAutomationRule).not.toHaveBeenCalled();
  expect(getAutomation).not.toHaveBeenCalled();
});
it("allows saved paused settings while preventing unavailable automatic sending", async () => {
  vi.stubEnv("STUDIO_AUTOMATIONS_ENABLED", "0");
  expect((await PUT(request())).status).toBe(503);
  expect((await PUT(request(false))).status).toBe(200);
  expect(saveAutomationRule).toHaveBeenCalledTimes(1);
  expect(getConnectionRow).not.toHaveBeenCalled();
});
it("checks entitlement and every selected account before arming", async () => {
  vi.mocked(canUsePremium).mockResolvedValueOnce(false);
  expect((await PUT(request())).status).toBe(402);
  expect(saveAutomationRule).not.toHaveBeenCalled();
  vi.mocked(getConnectionRow).mockResolvedValueOnce({
    externalAccountId: "another",
    status: "active",
  } as Awaited<ReturnType<typeof getConnectionRow>>);
  expect((await PUT(request())).status).toBe(409);
  expect(saveAutomationRule).not.toHaveBeenCalled();
});
it("saves exactly the account set reviewed by the creator", async () => {
  expect((await PUT(request())).status).toBe(200);
  expect(saveAutomationRule).toHaveBeenCalledWith(
    "user_test",
    expect.objectContaining({
      sourceAccountId: "ig",
      enabled: true,
      accounts: [
        { platform: "youtube", id: "yt", label: "youtube" },
        { platform: "tiktok", id: "tt", label: "tiktok" },
      ],
    }),
  );
});
it("reports setup as unavailable before migration, while preserving other database errors", async () => {
  vi.stubEnv("STUDIO_AUTOMATIONS_ENABLED", "0");
  vi.mocked(getAutomation).mockRejectedValueOnce({ cause: { code: "42P01" } });
  expect(await (await GET()).json()).toMatchObject({
    available: false,
    setupAvailable: false,
  });
  vi.mocked(getAutomation).mockRejectedValueOnce(
    new Error("database_unavailable"),
  );
  await expect(GET()).rejects.toThrow("database_unavailable");
});
