import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { getActiveProject, updateProject } from "@/lib/db/projects";
import { runStudioTurn } from "../turn";
import type { StudioTurnInput } from "../wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));

// Brand requests end to end against PostgreSQL with the model's replies
// scripted: the kit reaches the planner only on the Brand tab, a color change
// lands in the saved palette, and a logo goes only after a yes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-brand-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const gate = vi.fn(async () => {});
let logo = "";

function turn(content: string, surface = "/studio/brand"): StudioTurnInput {
  return {
    protocolVersion: 1,
    executionID: randomUUID(),
    surface,
    timeZone: "America/Toronto",
    messages: [{ role: "user", content }],
  };
}

function reply(plan: unknown) {
  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify(plan),
  });
}

function seen(call: number) {
  return JSON.parse(vi.mocked(callSceneModel).mock.calls[call][0].user);
}

beforeAll(async () => {
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
  const project = await getActiveProject(user);
  await updateProject(user, { brandColors: ["#FF7A21", "#151515"] });
  const { rows } = await pool.query(
    `insert into brand_assets(project_id, media_key, name, mime_type, media_bytes, is_primary)
     values ($1, $2, 'Old logo.png', 'image/png', 0, true) returning id`,
    [project.id, `u/${user}/brand/old-logo.png`],
  );
  logo = rows[0].id;
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("changes the palette and deletes a logo only after a yes", async () => {
  reply({
    message: "Made teal your primary color.",
    actions: [
      {
        action: "studio.brand.colors",
        arguments: { operation: "primary", colors: ["teal"] },
      },
    ],
  });
  const colors = await runStudioTurn(
    user,
    request,
    turn("make teal primary"),
    gate,
  );
  expect(seen(0).brand).toEqual({
    colors: ["#FF7A21", "#151515"],
    logos: [{ id: logo, name: "Old logo.png", primary: true }],
  });
  expect(colors.tone).toBe("done");
  expect(colors.effects).toEqual(["brand"]);
  expect(colors.notes).toEqual([
    "Brand colors are now #008080 (primary), #FF7A21, #151515.",
  ]);
  expect((await getActiveProject(user)).brandColors).toEqual([
    "#008080",
    "#FF7A21",
    "#151515",
  ]);

  reply({
    message: "",
    actions: [
      { action: "studio.brand.logos.delete", arguments: { logoID: logo } },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("delete the old logo"),
    gate,
  );
  expect(asked.confirm?.question).toBe(
    "Delete the “Old logo.png” logo? This can’t be undone.",
  );
  const before = await pool.query("select id from brand_assets where id = $1", [
    logo,
  ]);
  expect(before.rowCount).toBe(1);

  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.notes).toEqual(["Deleted the “Old logo.png” logo."]);
  expect(yes.effects).toEqual(["brand"]);
  const after = await pool.query("select id from brand_assets where id = $1", [
    logo,
  ]);
  expect(after.rowCount).toBe(0);
});

it("leaves the kit out of a turn that is not about it", async () => {
  reply({ message: "Your ideas are on the Ideas tab.", actions: [] });
  await runStudioTurn(
    user,
    request,
    turn("what should I post this week", "/studio/ideas"),
    gate,
  );
  expect(seen(0).brand).toBeUndefined();
});
