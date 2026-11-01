import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { createBrainBlock } from "@/lib/db/project-brain";
import { replacePillars } from "@/lib/db/project-pillars";
import { getActiveProject, updateProject } from "@/lib/db/projects";
import { runStudioTurn } from "../turn";
import type { StudioTurnInput } from "../wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));

// The Brain tab's requests end to end against PostgreSQL with the model's
// replies scripted: a question answered from the overview, Essentials and
// Knowledge edits, a pillar rename that keeps its ideas, and a delete that
// waits for a yes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-brain-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const gate = vi.fn(async () => {});
let projectID = "";
let mindset = "";
let hookBank = "";

function turn(content: string, surface = "/studio/brain"): StudioTurnInput {
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

/** What the planner was shown on its latest call. */
function seen() {
  return JSON.parse(vi.mocked(callSceneModel).mock.calls.at(-1)![0].user);
}

async function one(sql: string, params: unknown[]) {
  const { rows } = await pool.query(sql, params);
  return rows[0] ?? null;
}

beforeAll(async () => {
  await pool.query("insert into users(id, credits_balance) values ($1, 30)", [
    user,
  ]);
  const project = await getActiveProject(user);
  projectID = project.id;
  await updateProject(user, {
    audience: "Adults who just joined a gym.",
    doNots: "No body shaming.",
  });
  const pillars = await replacePillars(project.id, [
    { name: "Fitness" },
    { name: "Mindset", description: "Gym anxiety and consistency." },
  ]);
  mindset = pillars.find((pillar) => pillar.name === "Mindset")!.id;
  hookBank = (
    await createBrainBlock(project.id, {
      title: "Hook bank",
      kind: "list",
      items: ["Stop doing crunches", "Your coach is wrong about cardio"],
      digest: "Openers that held attention",
    })
  ).id;
  await createBrainBlock(project.id, {
    title: "Filming setup",
    body: "Sony camera, one softbox.",
  });
  await pool.query(
    "insert into content_items(user_id, title, pillar_id) values ($1, 'Gym anxiety week one', $2)",
    [user, mindset],
  );
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("answers from the Brain and reads it only where it is needed", async () => {
  reply({ message: "Adults who just joined a gym.", actions: [] });
  const answered = await runStudioTurn(
    user,
    request,
    turn("who is my audience?"),
    gate,
  );
  expect(answered.tone).toBe("answer");
  expect(answered.results).toEqual([]);
  const brain = seen().brain;
  expect(brain.essentials.audience).toBe("Adults who just joined a gym.");
  expect(brain.pillarNotes).toEqual({
    Mindset: "Gym anxiety and consistency.",
  });
  expect(brain.knowledge.map((line: { title: string }) => line.title)).toEqual([
    "Hook bank",
    "Filming setup",
  ]);

  reply({ message: "Moved it.", actions: [] });
  await runStudioTurn(
    user,
    request,
    turn("move gym anxiety to Friday", "/studio/ideas"),
    gate,
  );
  expect(seen().brain).toBeUndefined();
});

it("edits Essentials and Knowledge through the Brain's operations", async () => {
  reply({
    message: "Added it.",
    actions: [
      {
        action: "studio.brain.essentials.update",
        arguments: { doNots: "No swearing.", append: true },
      },
      {
        action: "studio.brain.knowledge.update",
        arguments: {
          blockID: hookBank,
          find: "crunches",
          replaceWith: "sit-ups",
          position: 2,
        },
      },
      {
        action: "studio.brain.knowledge.add",
        arguments: {
          title: "Editor",
          body: "My sister Ana edits my videos; credit her in captions.",
        },
      },
    ],
  });
  const edited = await runStudioTurn(
    user,
    request,
    turn("add no swearing to never say, fix the hook, and remember Ana"),
    gate,
  );
  expect(edited.tone).toBe("done");
  expect(edited.effects).toEqual(["brain"]);
  expect(edited.notes).toEqual([
    "Added to Never say in your Essentials.",
    "Updated “Hook bank” in your Knowledge. Moved “Hook bank” to position 2.",
    "Added “Editor” to your Knowledge.",
  ]);
  expect(
    (await one("select do_nots from projects where id = $1", [projectID]))
      .do_nots,
  ).toBe("No body shaming.\nNo swearing.");
  const { rows: blocks } = await pool.query(
    "select title, items, source_label from project_brain_blocks where project_id = $1 order by sort_order",
    [projectID],
  );
  expect(blocks.map((row) => row.title)).toEqual([
    "Filming setup",
    "Hook bank",
    "Editor",
  ]);
  expect(blocks[1].items[0]).toBe("Stop doing sit-ups");
  expect(blocks[2].source_label).toBe("Conversation with Chirpy");
});

it("renames a pillar in place and deletes only after a yes", async () => {
  reply({
    message: "Renamed it.",
    actions: [
      {
        action: "studio.brain.pillars.save",
        arguments: { pillarID: mindset, name: "Headspace" },
      },
    ],
  });
  const renamed = await runStudioTurn(
    user,
    request,
    turn("rename Mindset to Headspace"),
    gate,
  );
  expect(renamed.notes).toEqual([
    "Renamed the “Mindset” pillar to “Headspace”.",
  ]);
  expect(renamed.effects).toEqual(["brain", "ideas"]);
  const filed = await one(
    "select pillar_id from content_items where user_id = $1",
    [user],
  );
  expect(filed.pillar_id).toBe(mindset);

  const filming = (
    await one(
      "select id from project_brain_blocks where project_id = $1 and title = 'Filming setup'",
      [projectID],
    )
  ).id as string;
  reply({
    message: "",
    actions: [
      {
        action: "studio.brain.delete",
        arguments: { pillarIDs: [mindset], blockIDs: [filming] },
      },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("delete the Headspace pillar and my filming setup notes"),
    gate,
  );
  expect(asked.confirm?.question).toBe(
    "Delete the “Headspace” pillar and “Filming setup” from your Knowledge? This can’t be undone.",
  );
  expect(
    await one("select id from project_pillars where id = $1", [mindset]),
  ).not.toBeNull();

  const calls = vi.mocked(callSceneModel).mock.calls.length;
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(vi.mocked(callSceneModel).mock.calls.length).toBe(calls);
  expect(yes.notes).toEqual([
    "Deleted the “Headspace” pillar and “Filming setup” from your Knowledge. Any ideas filed there are now unfiled.",
  ]);
  expect(yes.effects).toEqual(["brain", "ideas"]);
  expect(
    await one("select id from project_pillars where id = $1", [mindset]),
  ).toBeNull();
  expect(
    (
      await one("select pillar_id from content_items where user_id = $1", [
        user,
      ])
    ).pillar_id,
  ).toBeNull();
  expect(
    await one("select id from project_brain_blocks where id = $1", [filming]),
  ).toBeNull();
});

it("writes a skill and turns it off", async () => {
  reply({
    message: "Added it.",
    actions: [
      {
        action: "studio.brain.skills.save",
        arguments: {
          name: "Cold opens",
          instructions: "Start on the claim, never on hello.",
          surfaces: ["hooks", "script"],
        },
      },
    ],
  });
  await runStudioTurn(user, request, turn("write a cold opens skill"), gate);
  const skill = await one(
    "select id, enabled, surfaces from project_skills where project_id = $1 and name = 'Cold opens'",
    [projectID],
  );
  expect(skill.enabled).toBe(true);
  expect(skill.surfaces).toEqual(["hooks", "script"]);

  reply({
    message: "Turned it off.",
    actions: [
      {
        action: "studio.brain.skills.save",
        arguments: { skillID: skill.id, enabled: false },
      },
    ],
  });
  const off = await runStudioTurn(
    user,
    request,
    turn("turn off cold opens"),
    gate,
  );
  expect(off.notes).toEqual(["Turned off “Cold opens”."]);
  expect(
    (await one("select enabled from project_skills where id = $1", [skill.id]))
      .enabled,
  ).toBe(false);
});
