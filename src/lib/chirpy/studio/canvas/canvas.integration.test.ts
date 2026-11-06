import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import {
  askCanvasAsSent,
  askIdeaCanvas,
} from "@/lib/content/operations/canvas-ask";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { getActiveProject } from "@/lib/db/projects";
import { askCanvas } from "@/lib/generate/canvas";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { resolveConfirmation } from "../confirm";
import { runStudioTurn } from "../turn";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));
vi.mock("@/lib/generate/canvas", () => ({ askCanvas: vi.fn() }));
vi.mock("@/lib/brain/context/server", () => ({
  getBrainContextSafe: vi.fn(async () => ({
    section: "",
    pillarNames: [],
    used: { skills: [], context: [] },
  })),
}));
vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: vi.fn(async () => true),
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderSpend: vi.fn(async () => null),
}));

// The canvas ask against PostgreSQL with the writer's reply scripted: a typed
// ask and a Chirpy turn leave the same saved document, another version is
// written on its own row, and the conversation clears only after a yes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-canvas-test-${randomUUID()}`;
const request = new Request("http://localhost/api/generate/canvas");
const timeZone = "America/Toronto";
const typed = randomUUID();
const asked = randomUUID();
const SCRIPT = "Old script that rambles on.";

const WRITER_REPLY = {
  actions: [
    {
      type: "replace" as const,
      index: 0,
      block: {
        label: "Script",
        kind: "script" as const,
        text: "Tight script.",
      },
    },
    { type: "hooks" as const, options: ["Stop."], replace: true },
  ],
  note: "Cut the script and the hook down.",
};

async function stored(id: string) {
  const { rows } = await pool.query(
    "select blocks, script, hooks from content_items where id = $1",
    [id],
  );
  return rows[0];
}

async function credits() {
  const { rows } = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  return rows[0].credits_balance as number;
}

beforeAll(async () => {
  process.env.SURPLUS_API_KEY ??= "test";
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
  const project = await getActiveProject(user);
  for (const id of [typed, asked])
    await pool.query(
      `insert into content_items(id, user_id, project_id, title, status, hooks, blocks, script)
       values ($1, $2, $3, 'Gym myths', 'drafting', $4, $5, $6)`,
      [
        id,
        user,
        project.id,
        JSON.stringify([{ text: "A long hook.", pattern: null, why: null }]),
        JSON.stringify([{ label: "Script", kind: "script", text: SCRIPT }]),
        SCRIPT,
      ],
    );
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => {
  vi.mocked(askCanvas).mockReset();
  vi.mocked(callSceneModel).mockReset();
});

it("leaves the same document for a typed ask and a Chirpy request", async () => {
  vi.mocked(askCanvas).mockResolvedValue(structuredClone(WRITER_REPLY));
  const answer = await askIdeaCanvas(request, user, {
    ideaID: typed,
    instruction: "tighten it",
  });
  expect(answer.ok).toBe(true);
  expect(vi.mocked(askCanvas).mock.calls[0][0]).toMatchObject({
    blocks: [{ label: "Script", kind: "script", text: SCRIPT }],
    hooks: ["A long hook."],
    format: "short",
  });

  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify({
      message: "Tightened it.",
      actions: [
        {
          action: "studio.ideas.canvasEdit",
          arguments: { ideaID: asked, instruction: "tighten it" },
        },
      ],
    }),
  });
  const reply = await runStudioTurn(
    user,
    new Request("http://localhost/api/chirpy/studio"),
    {
      protocolVersion: 1,
      executionID: randomUUID(),
      surface: "/studio/ideas",
      timeZone,
      messages: [{ role: "user", content: "tighten gym myths" }],
    },
    async () => {},
  );
  expect(reply).toMatchObject({
    message: "Cut the script and the hook down.",
    tone: "done",
    effects: ["ideaCanvas", "ideas"],
  });

  const [a, b] = [await stored(typed), await stored(asked)];
  expect(a).toEqual(b);
  expect(a).toEqual({
    blocks: [{ label: "Script", kind: "script", text: "Tight script." }],
    script: "Tight script.",
    hooks: [{ text: "Stop.", pattern: null, why: null }],
  });
  // Two canvas credits and one two-credit plan.
  expect(await credits()).toBe(16);
  const { rows } = await pool.query(
    "select role from content_messages where content_item_id = $1 order by created_at",
    [asked],
  );
  expect(rows.map((row) => row.role)).toEqual(["creator", "chirpy"]);
});

it("writes another version on its own row and leaves the lead alone", async () => {
  vi.mocked(askCanvas).mockResolvedValue({
    actions: [
      {
        type: "append",
        block: { label: "Intro", kind: "paragraph", text: "Long intro." },
      },
    ],
    note: null,
  });
  const before = await stored(typed);
  const answer = await askIdeaCanvas(request, user, {
    ideaID: typed,
    instruction: "start the long version",
    format: "long",
  });
  expect(answer.ok).toBe(true);
  expect(vi.mocked(askCanvas).mock.calls[0][0]).toMatchObject({
    blocks: [],
    format: "long",
  });
  const { rows } = await pool.query(
    "select blocks from content_versions where content_item_id = $1 and format = 'long'",
    [typed],
  );
  expect(rows[0].blocks).toEqual([
    { label: "Intro", kind: "paragraph", text: "Long intro." },
  ]);
  expect(await stored(typed)).toEqual(before);
});

it("clears the canvas conversation only after the creator confirms", async () => {
  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify({
      message: "",
      actions: [
        { action: "studio.ideas.clearThread", arguments: { ideaID: asked } },
      ],
    }),
  });
  const executionID = randomUUID();
  const proposed = await runStudioTurn(
    user,
    new Request("http://localhost/api/chirpy/studio"),
    {
      protocolVersion: 1,
      executionID,
      surface: "/studio/ideas",
      timeZone,
      messages: [{ role: "user", content: "clear the chat on gym myths" }],
    },
    async () => {},
  );
  expect(proposed.confirm?.question).toMatch(
    /^Clear Chirpy’s conversation on “Gym myths”\?/,
  );
  const count = async () =>
    (
      await pool.query(
        "select count(*)::int as n from content_messages where content_item_id = $1",
        [asked],
      )
    ).rows[0].n;
  expect(await count()).toBe(2);

  const yes = await resolveConfirmation(
    { userId: user, request, timeZone },
    executionID,
    "confirm",
  );
  expect(yes?.effects).toEqual(["ideaCanvas"]);
  expect(await count()).toBe(0);
  expect((await stored(asked)).script).toBe("Tight script.");
});

/** A fresh idea with the old script, for the tests below. */
async function freshIdea(): Promise<string> {
  const id = randomUUID();
  const project = await getActiveProject(user);
  await pool.query(
    `insert into content_items(id, user_id, project_id, title, status, hooks, blocks, script)
     values ($1, $2, $3, 'Gym myths', 'drafting', '[]', $4, $5)`,
    [
      id,
      user,
      project.id,
      JSON.stringify([{ label: "Script", kind: "script", text: SCRIPT }]),
      SCRIPT,
    ],
  );
  return id;
}

it("saves nothing and charges nothing when the creator saved during the ask", async () => {
  const id = await freshIdea();
  const before = await credits();
  // The creator's autosave lands while the writer is still working.
  vi.mocked(askCanvas).mockImplementation(async () => {
    const saved = await updateOwnContentItem(user, id, {
      blocks: [{ label: "Script", kind: "script", text: "Typed meanwhile." }],
      script: "Typed meanwhile.",
      base: {
        blocks: [{ label: "Script", kind: "script", text: SCRIPT }],
        script: SCRIPT,
      },
    });
    expect(saved.ok).toBe(true);
    return structuredClone(WRITER_REPLY);
  });
  const answer = await askIdeaCanvas(request, user, {
    ideaID: id,
    instruction: "tighten it",
  });
  expect(answer).toMatchObject({
    ok: false,
    status: 409,
    error: "changed_while_working",
  });
  expect((await stored(id)).script).toBe("Typed meanwhile.");
  expect(await credits()).toBe(before);
});

it("merges a stale canvas save into Chirpy's edit instead of reverting it", async () => {
  const id = await freshIdea();
  vi.mocked(askCanvas).mockResolvedValue({
    actions: [
      {
        type: "append",
        block: { label: "Protein", kind: "bullets", items: ["Eat more"] },
      },
    ],
    note: "Added a protein beat.",
  });
  expect(
    (await askIdeaCanvas(request, user, { ideaID: id, instruction: "add" })).ok,
  ).toBe(true);
  // A canvas open since before that edit saves typing on its old copy.
  const old = [{ label: "Script", kind: "script", text: SCRIPT }];
  const saved = await updateOwnContentItem(user, id, {
    blocks: [
      { label: "Script", kind: "script", text: "Typed on a stale copy." },
    ],
    script: "Typed on a stale copy.",
    base: { blocks: old, script: SCRIPT },
  });
  expect(saved).toMatchObject({ ok: true, value: { rebased: true } });
  expect(await stored(id)).toMatchObject({
    blocks: [
      { label: "Script", kind: "script", text: "Typed on a stale copy." },
      { label: "Protein", kind: "bullets", items: ["Eat more"] },
    ],
    script: "Typed on a stale copy.",
  });
});

it("lets an older client apply the reply itself and saves only the thread", async () => {
  const id = await freshIdea();
  vi.mocked(askCanvas).mockResolvedValue(structuredClone(WRITER_REPLY));
  const before = await credits();
  const answer = await askCanvasAsSent(request, user, {
    ideaID: id,
    instruction: "tighten it",
    piece: {
      title: "Gym myths",
      blocks: [{ label: "Script", kind: "script", text: "What it shows." }],
      hooks: [],
    },
  });
  expect(answer.ok).toBe(true);
  expect(vi.mocked(askCanvas).mock.calls[0][0]).toMatchObject({
    blocks: [{ label: "Script", kind: "script", text: "What it shows." }],
  });
  expect((await stored(id)).script).toBe(SCRIPT);
  expect(await credits()).toBe(before - 1);
  const { rows } = await pool.query(
    "select count(*)::int as n from content_messages where content_item_id = $1",
    [id],
  );
  expect(rows[0].n).toBe(2);
});
