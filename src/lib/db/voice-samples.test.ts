import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));

const {
  deleteVoiceSample,
  latestVoiceExcerpt,
  listVoiceSamples,
  readyVoiceTranscripts,
  upsertVoiceSample,
} = await import("./voice-samples");
const { getActiveProject } = await import("./projects");

const base = {
  userId: "user_test",
  platform: "instagram" as const,
  url: "https://instagram.com/p/x",
  thumbnail: null,
  publishedAt: null,
  durationSec: 90,
  status: "ready" as const,
  creditsCharged: 1,
  error: null,
};

describe("voice samples", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  }, 30_000);
  beforeEach(async () => {
    await client.exec("TRUNCATE users CASCADE");
    await db
      .insert(schema.users)
      .values([{ id: "user_test" }, { id: "user_other" }]);
  });

  it("keeps one row per video and replaces a retry", async () => {
    const project = await getActiveProject("user_test");
    await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "a",
      title: "First",
      transcript: "old words",
    });
    await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "a",
      title: "First",
      transcript: "new words",
    });
    const rows = await listVoiceSamples(project.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].transcript).toBe("new words");
  });

  it("reads ready transcripts newest first and excerpts the latest", async () => {
    const project = await getActiveProject("user_test");
    await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "a",
      title: "Older",
      transcript: "older talk",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "b",
      title: "Newer",
      transcript: "newer talk",
    });
    await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "c",
      title: "Silent",
      transcript: "",
    });
    const ready = await readyVoiceTranscripts(project.id);
    expect(ready.map((row) => row.title)).toEqual(["Newer", "Older"]);
    expect(await latestVoiceExcerpt(project.id)).toBe("newer talk");
  });

  it("only the owner can remove a sample", async () => {
    const project = await getActiveProject("user_test");
    const row = await upsertVoiceSample({
      ...base,
      projectId: project.id,
      externalPostId: "a",
      title: "Mine",
      transcript: "words",
    });
    expect(await deleteVoiceSample("user_other", row.id)).toBe(false);
    expect(await deleteVoiceSample("user_test", row.id)).toBe(true);
    expect(await listVoiceSamples(project.id)).toHaveLength(0);
  });
});
