import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { replacePillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { resolveConfirmation } from "./confirm";
import { runStudioTurn } from "./turn";
import type { StudioTurnInput } from "./wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));

// The three requests Studio Chirpy has to handle, end to end against
// PostgreSQL with the model's replies scripted: make an idea and put it on
// Friday, move it to a pillar, delete it only after a yes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-studio-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const timeZone = "America/Toronto";
let mindset = "";
const gate = vi.fn(async () => {});

function turn(content: string, executionID = randomUUID()): StudioTurnInput {
  return {
    protocolVersion: 1,
    executionID,
    surface: "/studio/ideas",
    timeZone,
    messages: [{ role: "user", content }],
  };
}

function reply(plan: unknown) {
  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify(plan),
  });
}

async function balance() {
  const { rows } = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  return rows[0].credits_balance as number;
}

async function idea(id: string) {
  const { rows } = await pool.query(
    "select original_note, scheduled_for, pillar_id from content_items where id = $1 and user_id = $2",
    [id, user],
  );
  return rows[0] ?? null;
}

/** The next upcoming Friday in Toronto, as the planner's overview lists it. */
function friday(): string {
  const day = new Date();
  for (let index = 0; index < 8; index++) {
    const at = new Date(day.getTime() + index * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    }).format(at);
    if (weekday === "Friday")
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
  }
  throw new Error("no Friday");
}

beforeAll(async () => {
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
  const project = await getActiveProject(user);
  const pillars = await replacePillars(project.id, [
    { name: "Fitness" },
    { name: "Mindset" },
  ]);
  mindset = pillars.find((pillar) => pillar.name === "Mindset")!.id;
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("makes an idea, files it, and deletes it only after a yes", async () => {
  const day = friday();

  // 1. "Make an idea about X and put it on Friday": the words are saved and
  // scheduled at 09:00 local. No provider here, so the first draft refunds
  // and says so, as the composer does.
  reply({
    message: "Made an idea about quitting the gym in February for Friday.",
    actions: [
      {
        action: "studio.ideas.capture",
        arguments: {
          note: "why most people quit the gym in February",
          date: day,
        },
      },
    ],
  });
  const made = await runStudioTurn(
    user,
    request,
    turn(
      "make an idea about why most people quit the gym in February and put it on Friday",
    ),
    gate,
  );
  expect(made.results).toHaveLength(1);
  expect(made.results[0].status).toBe("done");
  expect(made.effects).toEqual(["ideas"]);
  expect(made.notes[0]).toMatch(/^Created “why most people quit the gym/);
  expect(made.notes[0]).toMatch(/Your words are saved\.$/);
  expect(await balance()).toBe(18);
  const { rows: created } = await pool.query(
    "select id from content_items where user_id = $1",
    [user],
  );
  expect(created).toHaveLength(1);
  const id = created[0].id as string;
  const saved = await idea(id);
  expect(saved.original_note).toBe("why most people quit the gym in February");
  expect(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(saved.scheduled_for),
  ).toBe(`${day}, 09:00`);

  // 2. "Move this idea to Mindset": the overview read from the database
  // carries the idea and the pillar, and the edit uses the same ownership
  // checks as the Ideas controls.
  reply({
    message: "Filed it under Mindset.",
    actions: [
      {
        action: "studio.ideas.setPillar",
        arguments: { ideaIDs: [id], pillarID: mindset },
      },
    ],
  });
  const moved = await runStudioTurn(
    user,
    request,
    turn("move this idea to Mindset"),
    gate,
  );
  const seen = JSON.parse(vi.mocked(callSceneModel).mock.calls[1][0].user);
  expect(seen.ideas.map((item: { id: string }) => item.id)).toContain(id);
  expect(seen.pillars.map((item: { name: string }) => item.name)).toEqual([
    "Fitness",
    "Mindset",
  ]);
  expect(seen.today.timeZone).toBe(timeZone);
  expect(moved.notes).toEqual([
    "Filed “why most people quit the gym in February” under “Mindset”.",
  ]);
  expect((await idea(id)).pillar_id).toBe(mindset);

  // 3. "Delete that idea" waits for the creator. A retried request is not
  // charged again and runs nothing.
  const deleteTurn = turn("delete that idea");
  reply({
    message: "",
    actions: [{ action: "studio.ideas.delete", arguments: { ideaIDs: [id] } }],
  });
  const asked = await runStudioTurn(user, request, deleteTurn, gate);
  expect(asked.confirm?.question).toBe(
    "Delete “why most people quit the gym in February”? This can’t be undone.",
  );
  expect(asked.results).toEqual([]);
  expect(await idea(id)).not.toBeNull();
  const again = await runStudioTurn(user, request, deleteTurn, gate);
  expect(again.confirm?.executionID).toBe(deleteTurn.executionID);
  expect(vi.mocked(callSceneModel)).toHaveBeenCalledTimes(3);
  expect(await balance()).toBe(14);

  // 4. A typed yes runs it with no model call and no credit.
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(vi.mocked(callSceneModel)).toHaveBeenCalledTimes(3);
  expect(yes.tone).toBe("done");
  expect(yes.notes).toEqual([
    "Deleted “why most people quit the gym in February”.",
  ]);
  expect(await idea(id)).toBeNull();
  expect(await balance()).toBe(14);

  // A second confirmation reports what happened instead of running again.
  const late = await resolveConfirmation(
    { userId: user, request, timeZone },
    deleteTurn.executionID,
    "confirm",
  );
  expect(late?.notes).toEqual(yes.notes);
});

it("keeps the idea when the creator says no", async () => {
  reply({
    message: "Saved the note.",
    actions: [
      {
        action: "studio.ideas.capture",
        arguments: { note: "sleep trackers make sleep worse", draft: false },
      },
    ],
  });
  const made = await runStudioTurn(
    user,
    request,
    turn("just jot down: sleep trackers make sleep worse"),
    gate,
  );
  expect(made.tone).toBe("done");
  expect(made.message).toBe("Saved the note.");
  const { rows } = await pool.query(
    "select id from content_items where user_id = $1",
    [user],
  );
  const id = rows[0].id as string;

  const deleteTurn = turn("delete it");
  reply({
    message: "",
    actions: [{ action: "studio.ideas.delete", arguments: { ideaIDs: [id] } }],
  });
  await runStudioTurn(user, request, deleteTurn, gate);
  const kept = await resolveConfirmation(
    { userId: user, request, timeZone },
    deleteTurn.executionID,
    "cancel",
  );
  expect(kept?.message).toBe("Kept it. Nothing was deleted.");
  expect(await idea(id)).not.toBeNull();
  // A yes after the no has nothing left to confirm, so it is a new request.
  reply({ message: "There’s nothing waiting to confirm.", actions: [] });
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.tone).toBe("answer");
  expect(await idea(id)).not.toBeNull();
});
