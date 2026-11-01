import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { resolveConfirmation } from "./confirm";
import { runStudioTurn } from "./turn";
import type { StudioTurnInput } from "./wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));
vi.mock("@/lib/db/r2-drain", () => ({ drainR2AfterResponse: () => {} }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => {},
}));

// Poster and the calendar end to end against PostgreSQL with the model's
// replies scripted: "post this" fills Poster in and posts nothing, and a
// scheduled post moves or cancels only after a yes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-poster-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const timeZone = "America/Toronto";
const gate = vi.fn(async () => {});
let video = "";

function turn(content: string, surface = "/studio/poster"): StudioTurnInput {
  return {
    protocolVersion: 1,
    executionID: randomUUID(),
    surface,
    timeZone,
    messages: [{ role: "user", content }],
  };
}

function reply(plan: unknown) {
  vi.mocked(callSceneModel).mockResolvedValueOnce({
    content: JSON.stringify(plan),
  });
}

/** A local day a few days out, as the planner's overview lists them. */
function dayAhead(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

async function schedule(platform: string) {
  const { rows } = await pool.query(
    `insert into publishing_schedules
       (user_id, request_key, request_hash, entry_index, platform,
        external_account_id, account_label, title, content_item_id, input,
        scheduled_for, timezone)
     values ($1, $2, 'hash', 0, $3, 'acct', '@me', 'Desk tour', $4,
             '{"mediaKey":"k"}', now() + interval '2 days', $5)
     returning id`,
    [user, randomUUID(), platform, video, timeZone],
  );
  return rows[0].id as string;
}

async function scheduleRow(id: string) {
  const { rows } = await pool.query(
    "select status, scheduled_for from publishing_schedules where id = $1",
    [id],
  );
  return rows[0];
}

beforeAll(async () => {
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "1");
  vi.stubEnv("CRON_SECRET", "test");
  await pool.query("insert into users(id, credits_balance) values ($1, 20)", [
    user,
  ]);
  await pool.query(
    `insert into r2_objects (user_id, media_key, purpose, state, media_bytes)
     values ($1, $2, 'recording', 'active', 100)`,
    [user, `${user}/desk.mp4`],
  );
  const { rows: submission } = await pool.query(
    `insert into submissions (user_id, kind, status, title, media_key, media_bytes)
     values ($1, 'video', 'complete', 'Desk tour', $2, 100) returning id`,
    [user, `${user}/desk.mp4`],
  );
  const { rows: item } = await pool.query(
    `insert into content_items (user_id, title, submission_id, source_url, stage)
     values ($1, 'Desk tour', $2, 'yapper://poster-upload', 'library')
     returning id`,
    [user, submission[0].id],
  );
  video = item[0].id;
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("fills Poster in for “post this” and posts nothing", async () => {
  const day = dayAhead(3);
  reply({
    message: "It's ready in Poster for TikTok.",
    actions: [
      {
        action: "studio.poster.prepare",
        arguments: {
          videoID: video,
          platforms: ["tiktok"],
          caption: "my whole setup",
          date: day,
          time: "18:00",
        },
      },
    ],
  });
  const before = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  const prepared = await runStudioTurn(
    user,
    request,
    turn("post this to TikTok friday at 6pm"),
    gate,
  );
  expect(prepared.tone).toBe("done");
  expect(prepared.confirm).toBeUndefined();
  expect(prepared.open).toMatchObject({
    tab: "poster",
    params: {
      videoID: video,
      title: "Desk tour",
      platforms: ["tiktok"],
      captions: [
        { platform: "tiktok", title: "", body: "my whole setup", hashtags: [] },
      ],
    },
  });
  expect(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      dateStyle: "short",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(new Date(prepared.open!.params.scheduleAt!)),
  ).toBe(`${day}, 18:00`);
  expect(prepared.notes[0]).toMatch(/press Schedule there/);
  const posted = await pool.query(
    "select (select count(*) from publishing_schedules where user_id = $1)::int schedules, (select count(*) from publish_jobs where user_id = $1)::int jobs",
    [user],
  );
  expect(posted.rows[0]).toEqual({ schedules: 0, jobs: 0 });
  const after = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  // Only the planning call is charged.
  expect(before.rows[0].credits_balance - after.rows[0].credits_balance).toBe(
    2,
  );
});

it("tells an older Mac build what to do instead of claiming Poster opened", async () => {
  reply({
    message: "It's set up in Poster.",
    actions: [
      {
        action: "studio.poster.writeCaptions",
        arguments: { videoID: video, platforms: ["youtube"] },
      },
    ],
  });
  const before = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  const refused = await runStudioTurn(
    user,
    request,
    { ...turn("write captions for the desk tour"), canOpen: false },
    gate,
  );
  expect(refused.tone).toBe("trouble");
  expect(refused.open).toBeUndefined();
  expect(refused.message).toMatch(
    /This version of the Mac app can’t open Poster/,
  );
  const after = await pool.query(
    "select credits_balance from users where id = $1",
    [user],
  );
  // The planning call only; the captions were never written.
  expect(before.rows[0].credits_balance - after.rows[0].credits_balance).toBe(
    2,
  );
});

it("cancels a scheduled post only after a yes", async () => {
  const id = await schedule("tiktok");
  reply({
    message: "Canceled it.",
    actions: [
      { action: "studio.calendar.cancel", arguments: { scheduleIDs: [id] } },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("cancel the desk tour post", "/studio/calendar"),
    gate,
  );
  expect(asked.confirm).toMatchObject({
    question: "Cancel “Desk tour” on TikTok? It won’t go out.",
    confirmLabel: "Cancel post",
  });
  expect((await scheduleRow(id)).status).toBe("scheduled");

  const done = await resolveConfirmation(
    { userId: user, request, timeZone },
    asked.executionID,
    "confirm",
  );
  expect(done).toMatchObject({ tone: "done", effects: ["schedules"] });
  expect(done!.notes[0]).toBe(
    "Canceled “Desk tour” on TikTok. The video and its idea are still there.",
  );
  expect((await scheduleRow(id)).status).toBe("cancelled");
});

it("moves a scheduled post after a yes, keeping its time", async () => {
  const id = await schedule("youtube");
  const was = (await scheduleRow(id)).scheduled_for as Date;
  const day = dayAhead(5);
  reply({
    message: "Moved it.",
    actions: [
      {
        action: "studio.calendar.reschedule",
        arguments: { scheduleIDs: [id], date: day },
      },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("move the desk tour to later in the week", "/studio/calendar"),
    gate,
  );
  expect(asked.confirm?.confirmLabel).toBe("Move");
  expect((await scheduleRow(id)).scheduled_for).toEqual(was);

  const moved = await resolveConfirmation(
    { userId: user, request, timeZone },
    asked.executionID,
    "confirm",
  );
  expect(moved).toMatchObject({
    tone: "done",
    effects: ["schedules", "ideas"],
  });
  const local = (at: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      dateStyle: "short",
      timeStyle: "short",
      hourCycle: "h23",
    })
      .format(at)
      .split(", ");
  const now = (await scheduleRow(id)).scheduled_for as Date;
  expect(local(now)).toEqual([day, local(was)[1]]);
});

it("removes a Poster upload only after a yes", async () => {
  reply({
    message: "Removed it.",
    actions: [
      {
        action: "studio.poster.removeUpload",
        arguments: { videoIDs: [video] },
      },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("remove the desk tour upload"),
    gate,
  );
  expect(asked.confirm).toMatchObject({
    question: "Remove “Desk tour” from Poster? This can’t be undone.",
    confirmLabel: "Remove",
  });
  const waiting = await pool.query(
    "select count(*)::int n from content_items where id = $1",
    [video],
  );
  expect(waiting.rows[0].n).toBe(1);

  const done = await resolveConfirmation(
    { userId: user, request, timeZone },
    asked.executionID,
    "confirm",
  );
  expect(done).toMatchObject({ tone: "done", effects: ["posterVideos"] });
  const gone = await pool.query(
    "select count(*)::int n from content_items where id = $1",
    [video],
  );
  expect(gone.rows[0].n).toBe(0);
});
