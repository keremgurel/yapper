import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { resolveConfirmation } from "../confirm";
import { runStudioTurn } from "../turn";
import type { StudioTurnInput } from "../wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));

// The cross-posting rule end to end against PostgreSQL with the model's
// replies scripted: a change waits for a yes and saves through the tab's
// operation, a no leaves it, and turning it on where automations don't run
// fails in words.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-automations-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const gate = vi.fn(async () => {});
const context = { userId: user, request, timeZone: "America/Toronto" };

function turn(content: string): StudioTurnInput {
  return {
    protocolVersion: 1,
    executionID: randomUUID(),
    surface: "/studio/automations",
    timeZone: "America/Toronto",
    messages: [{ role: "user", content }],
  };
}

function reply(plan: unknown) {
  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify(plan),
  });
}

async function savedRule() {
  const { rows } = await pool.query(
    "select enabled, settings, version from automation_rules where user_id = $1",
    [user],
  );
  return rows[0] ?? null;
}

beforeAll(async () => {
  delete process.env.STUDIO_AUTOMATIONS_ENABLED;
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("changes the rule only after a yes, and leaves it after a no", async () => {
  const change = {
    message: "",
    actions: [
      {
        action: "studio.automations.update",
        arguments: { destinations: ["youtube"] },
      },
    ],
  };
  reply(change);
  const first = turn("only copy to YouTube");
  const asked = await runStudioTurn(user, request, first, gate);
  const seen = JSON.parse(vi.mocked(callSceneModel).mock.calls[0][0].user);
  expect(seen.automations).toEqual({
    available: false,
    rule: null,
    connected: {},
    recentRuns: [],
  });
  expect(asked.confirm).toMatchObject({
    question: "Copy new Instagram posts to YouTube?",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
  });
  const no = await resolveConfirmation(context, first.executionID, "cancel");
  expect(no?.message).toBe("Left it as it was. Nothing changed.");
  expect(await savedRule()).toBeNull();

  reply(change);
  await runStudioTurn(user, request, turn("only copy to YouTube"), gate);
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.notes).toEqual(["Cross-posting is off."]);
  expect(yes.effects).toEqual(["automations"]);
  expect(await savedRule()).toMatchObject({
    enabled: false,
    version: 1,
    settings: { destinations: ["youtube"] },
  });
});

it("says so when turning it on where automations don't run", async () => {
  reply({
    message: "",
    actions: [
      {
        action: "studio.automations.update",
        arguments: { enabled: true, destinations: ["youtube"] },
      },
    ],
  });
  await runStudioTurn(user, request, turn("turn cross-posting on"), gate);
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.tone).toBe("trouble");
  expect(yes.message).toBe(
    "Cross-posting isn’t running on this server yet, so I left the rule off.",
  );
  expect((await savedRule()).version).toBe(1);
});
