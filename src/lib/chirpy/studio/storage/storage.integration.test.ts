import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { runStudioTurn } from "../turn";
import type { StudioTurnInput } from "../wire";

vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
  sceneModelFailureReason: () => "ai_failed",
}));

// Storage requests end to end against PostgreSQL with the model's replies
// scripted: the Storage tab sees its largest videos, a removal waits for a
// yes and gives the space back, and a recording goes with its transcript.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const user = `chirpy-storage-test-${randomUUID()}`;
const request = new Request("http://localhost/api/chirpy/studio");
const gate = vi.fn(async () => {});
const MB = 1024 * 1024;
const recordings: Record<string, string> = {};

function turn(content: string, surface = "/studio/storage"): StudioTurnInput {
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

async function storedBytes() {
  const { rows } = await pool.query(
    "select storage_bytes from users where id = $1",
    [user],
  );
  return Number(rows[0].storage_bytes);
}

beforeAll(async () => {
  await pool.query(
    "insert into users(id, credits_balance, storage_bytes) values ($1, 20, $2)",
    [user, 600 * MB],
  );
  for (const [name, title, bytes] of [
    ["gym", "Gym myths take 3", 400 * MB],
    ["qa", "Q&A live", 200 * MB],
  ] as const) {
    const key = `u/${user}/${name}.mp4`;
    await pool.query(
      `insert into r2_objects(user_id, media_key, purpose, state, media_bytes, created_at)
       values ($1, $2, 'recording', 'active', $3, now() - interval '30 days')`,
      [user, key, bytes],
    );
    const { rows } = await pool.query(
      `insert into submissions(user_id, media_key, media_bytes, kind, status, title, transcript, created_at, updated_at)
       values ($1, $2, $3, 'video', 'complete', $4, '["keep these words"]', now() - interval '30 days', now() - interval '30 days')
       returning id`,
      [user, key, bytes, title],
    );
    recordings[name] = rows[0].id;
  }
});

afterAll(async () => {
  await pool.query("delete from users where id = $1", [user]);
  await pool.end();
});

beforeEach(() => vi.mocked(callSceneModel).mockReset());

it("removes the biggest video only after a yes and keeps its transcript", async () => {
  reply({
    message: "",
    actions: [
      {
        action: "studio.storage.removeVideos",
        arguments: { videoIDs: ["gym.mp4"] },
      },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("delete my biggest video"),
    gate,
  );
  const storage = seen(0).storage;
  expect(storage).toMatchObject({ used: "600 MB", totalVideos: 2 });
  expect(storage.largest[0]).toEqual({
    id: "gym.mp4",
    title: "Gym myths take 3",
    size: "400 MB",
    kind: "recording",
    recordingID: recordings.gym,
  });
  expect(asked.confirm?.question).toBe(
    "Remove “Gym myths take 3” from storage, freeing 400 MB? This can’t be undone.",
  );
  expect(await storedBytes()).toBe(600 * MB);

  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.notes).toEqual([
    "Removed “Gym myths take 3” from storage, freeing 400 MB.",
  ]);
  expect(yes.effects).toEqual(["storage", "ideas"]);
  expect(await storedBytes()).toBe(200 * MB);
  const { rows } = await pool.query(
    "select media_key, transcript from submissions where id = $1",
    [recordings.gym],
  );
  expect(rows[0]).toEqual({
    media_key: null,
    transcript: ["keep these words"],
  });
});

it("deletes a recording with its transcript after a yes", async () => {
  reply({
    message: "",
    actions: [
      {
        action: "studio.storage.deleteRecording",
        arguments: { recordingID: recordings.qa },
      },
    ],
  });
  const asked = await runStudioTurn(
    user,
    request,
    turn("delete the Q&A recording and its transcript"),
    gate,
  );
  expect(asked.confirm?.question).toBe(
    "Delete the “Q&A live” recording with its transcript and feedback, freeing up to 200 MB? This can’t be undone.",
  );
  const yes = await runStudioTurn(user, request, turn("yes"), gate);
  expect(yes.notes).toEqual([
    "Deleted the “Q&A live” recording with its transcript and feedback.",
  ]);
  const { rowCount } = await pool.query(
    "select id from submissions where id = $1",
    [recordings.qa],
  );
  expect(rowCount).toBe(0);
  expect(await storedBytes()).toBe(0);
});

it("sends only the usage numbers off the Storage tab", async () => {
  reply({ message: "You’re using 0 B of your storage.", actions: [] });
  await runStudioTurn(
    user,
    request,
    turn("how much storage am I using", "/studio/ideas"),
    gate,
  );
  expect(Object.keys(seen(0).storage).sort()).toEqual([
    "percent",
    "quota",
    "used",
  ]);
});
