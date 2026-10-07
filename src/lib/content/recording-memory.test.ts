import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

const client = new PGlite();
const db = drizzle(client, { schema });
const mocks = vi.hoisted(() => ({ classify: vi.fn(), allow: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("./classify-recording", () => ({ classifyRecording: mocks.classify }));
vi.mock("@/lib/provider-rate-limit", () => ({ guardRouterSpend: mocks.allow }));
vi.mock("@/lib/publish/tokens", () => ({
  encryptToken: (value: string) => value,
}));
const { enrichRecording, hydrateRecording, repairPostedRecordings } =
  await import("./recording-memory");
const {
  createContentItem,
  updateContentItem,
  getContentItem,
  listContentItems,
} = await import("@/lib/db/content");
const { completePublishJob } = await import("@/lib/db/publish");
const { readPublishedMemory } = await import("@/lib/db/published-memory");
let projectId: string;
let pillarId: string;
let otherProject: string;
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
afterAll(async () => {
  await client.close();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "test-key");
  mocks.allow.mockResolvedValue(true);
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
  const projects = await db
    .insert(schema.projects)
    .values([{ userId: "owner" }, { userId: "other" }])
    .returning();
  projectId = projects[0].id;
  otherProject = projects[1].id;
  const [pillar] = await db
    .insert(schema.projectPillars)
    .values({
      projectId,
      name: "Ship log",
      description: "Building products in public",
      examples: ["What I shipped today"],
    })
    .returning();
  pillarId = pillar.id;
  mocks.classify.mockResolvedValue(pillarId);
});
const recorded = () =>
  createContentItem("owner", {
    title: "ep14",
    sourceUrl: "yapper://project/test",
    recordedTranscript: "Today I shipped a faster editor.",
    status: "posted",
  });

it("repairs an old posted project with verbatim speech and an owned pillar, once", async () => {
  const item = await recorded();
  await repairPostedRecordings("owner");
  const saved = await getContentItem("owner", item.id);
  expect(saved).toMatchObject({
    script: item.recordedTranscript,
    recordedTranscript: item.recordedTranscript,
    pillarId,
    status: "posted",
    updatedAt: item.updatedAt,
  });
  expect(mocks.classify.mock.calls[0][2][0]).toMatchObject({
    id: pillarId,
    description: "Building products in public",
    examples: ["What I shipped today"],
  });
  await enrichRecording("owner", item.id);
  expect(mocks.classify).toHaveBeenCalledTimes(1);
});

it("captures late transcripts and leaves existing script prose and pillar choices intact", async () => {
  const item = await createContentItem("owner", {
    title: "Draft",
    script: "My written draft",
    pillar: "My choice",
  });
  await updateContentItem("owner", item.id, {
    recordedTranscript: "Actual words",
    transcriptStatus: "ready",
  });
  await enrichRecording("owner", item.id);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    script: "My written draft",
    pillar: "My choice",
    recordedTranscript: "Actual words",
  });
  expect(mocks.classify).not.toHaveBeenCalled();
});

it("keeps explicit clearing of script and pillar cleared on later reads", async () => {
  const item = await recorded();
  await enrichRecording("owner", item.id);
  await updateContentItem("owner", item.id, {
    script: null,
    blocks: [],
    pillarId: null,
  });
  await hydrateRecording("owner", item.id);
  await enrichRecording("owner", item.id);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    script: null,
    pillarId: null,
    memoryScriptManual: true,
    memoryPillarManual: true,
  });
  expect(mocks.classify).toHaveBeenCalledTimes(1);
});

it("fills empty script blocks without dropping notes and refreshes an untouched copy", async () => {
  const item = await createContentItem("owner", {
    blocks: [
      { kind: "paragraph", label: "Note", text: "Keep this" },
      { kind: "script", label: "Script", text: "" },
    ],
  });
  await updateContentItem("owner", item.id, {
    recordedTranscript: "First take",
  });
  await updateContentItem("owner", item.id, {
    recordedTranscript: "Final edit",
  });
  expect(await getContentItem("owner", item.id)).toMatchObject({
    script: "Final edit",
    blocks: [
      { kind: "paragraph", label: "Note", text: "Keep this" },
      { kind: "script", label: "Script", text: "Final edit" },
    ],
  });
});

it("ignores unowned items, foreign submission transcripts and inspiration transcripts", async () => {
  const mine = await recorded();
  await enrichRecording("other", mine.id);
  expect((await getContentItem("owner", mine.id))?.script).toBeNull();
  const [submission] = await db
    .insert(schema.submissions)
    .values({
      userId: "other",
      kind: "video",
      transcript: [{ text: "Private speech" }],
    })
    .returning();
  const item = await createContentItem("owner", {
    submissionId: submission.id,
    sourceTranscript: "Someone else's video",
    sourceUrl: "https://example.com",
  });
  await enrichRecording("owner", item.id);
  expect((await getContentItem("owner", item.id))?.script).toBeNull();
  expect(mocks.classify).not.toHaveBeenCalled();
});

it("recovers a legacy own take and legacy Poster speech without re-transcribing", async () => {
  const [submission] = await db
    .insert(schema.submissions)
    .values({
      userId: "owner",
      kind: "video",
      transcript: { words: [{ text: "My" }, { text: "take." }] },
    })
    .returning();
  const item = await createContentItem("owner", {
    submissionId: submission.id,
  });
  expect(await hydrateRecording("owner", item.id)).toMatchObject({
    script: "My take.",
    recordedTranscript: "My take.",
  });
  const legacy = await createContentItem("owner", {
    sourceUrl: "yapper://poster-upload",
    sourceTranscript: "My old export",
    status: "posted",
  });
  expect(await hydrateRecording("owner", legacy.id)).toMatchObject({
    script: "My old export",
  });
  expect((await listContentItems("owner")).map((row) => row.id)).toContain(
    legacy.id,
  );
});

it("preserves a manual pillar change made while classification is running", async () => {
  const item = await recorded();
  mocks.classify.mockImplementation(async () => {
    await updateContentItem("owner", item.id, { pillar: "Manual choice" });
    return pillarId;
  });
  await enrichRecording("owner", item.id);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    pillar: "Manual choice",
    pillarId: null,
  });
});

it("does not let an old classification attach to a changed transcript", async () => {
  const item = await recorded();
  mocks.classify.mockImplementation(async () => {
    await updateContentItem("owner", item.id, {
      recordedTranscript: "A different edit",
    });
    return pillarId;
  });
  await enrichRecording("owner", item.id);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    recordedTranscript: "A different edit",
    pillarId: null,
    memoryFingerprint: null,
  });
});

it("persists speech when the provider fails, cools down retries, and remembers no match", async () => {
  const item = await recorded();
  mocks.classify.mockRejectedValueOnce(new Error("provider unavailable"));
  await enrichRecording("owner", item.id);
  await enrichRecording("owner", item.id);
  expect(mocks.classify).toHaveBeenCalledTimes(1);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    script: item.recordedTranscript,
    pillarId: null,
    memoryFingerprint: null,
  });
  await db
    .update(schema.contentItems)
    .set({ memoryAttemptedAt: new Date(0) })
    .where(eq(schema.contentItems.id, item.id));
  mocks.classify.mockResolvedValue(null);
  await enrichRecording("owner", item.id);
  await enrichRecording("owner", item.id);
  expect(mocks.classify).toHaveBeenCalledTimes(2);
  expect(
    (await getContentItem("owner", item.id))?.memoryFingerprint,
  ).toBeTruthy();
});

it("published state and script survive classifier failure; drafts do not become posted", async () => {
  const item = await recorded();
  await updateContentItem("owner", item.id, { status: "ready" });
  const [job] = await db
    .insert(schema.publishJobs)
    .values({
      userId: "owner",
      platform: "instagram",
      mediaKey: "u/owner/video.mp4",
      contentItemId: item.id,
    })
    .returning();
  await completePublishJob(job.id, {
    externalPostId: "draft",
    externalUrl: "https://example.com",
    draft: true,
  });
  expect((await getContentItem("owner", item.id))?.status).toBe("ready");
  mocks.classify.mockRejectedValue(new Error("unavailable"));
  await completePublishJob(job.id, {
    externalPostId: "posted",
    externalUrl: "https://example.com",
  });
  expect(await getContentItem("owner", item.id)).toMatchObject({
    status: "posted",
    script: item.recordedTranscript,
  });
});

it("retrieves only the latest three posted scripts in the requested pillar by publication time", async () => {
  for (let n = 1; n <= 5; n++) {
    const item = await createContentItem("owner", {
      title: `ep${n}`,
      pillarId,
      status: "posted",
      script: `Draft ${n}`,
      recordedTranscript: `Spoken ${n}`,
    });
    await db.insert(schema.publishJobs).values({
      userId: "owner",
      platform: "youtube",
      mediaKey: `u/owner/${n}.mp4`,
      contentItemId: item.id,
      status: "published",
      updatedAt: new Date(`2026-10-0${n}T00:00:00Z`),
    });
    if (n === 1)
      await updateContentItem("owner", item.id, { title: "Old edited title" });
  }
  await createContentItem("owner", {
    title: "Not published",
    status: "ready",
    pillarId,
    recordedTranscript: "Draft",
  });
  await createContentItem("other", {
    title: "Other user's newest",
    status: "posted",
    pillarId,
    recordedTranscript: "Private",
  });
  const rows = await readPublishedMemory("owner", projectId, {
    mode: "pillar",
    pillarId,
    limit: 99,
  });
  expect(rows.map((r) => r.title)).toEqual(["ep5", "ep4", "ep3"]);
  expect(rows.map((r) => r.script)).toEqual([
    "Spoken 5",
    "Spoken 4",
    "Spoken 3",
  ]);
  expect(
    await readPublishedMemory("other", otherProject, {
      mode: "title",
      query: "ep5",
      limit: 1,
    }),
  ).toEqual([]);
});

it("matches exact titles or topic search, never source material, and caps script context", async () => {
  const item = await createContentItem("owner", {
    title: "ep14",
    status: "posted",
    recordedTranscript: "pricing " + "x".repeat(10000),
    sourceTranscript: "unrelated-secret-topic",
  });
  await createContentItem("owner", {
    title: "ep140",
    status: "posted",
    script: "Other",
  });
  const rows = await readPublishedMemory("owner", projectId, {
    mode: "title",
    query: "EP 14",
    limit: 1,
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: item.id, truncated: true });
  expect(rows[0].script).toHaveLength(4000);
  expect(
    await readPublishedMemory("owner", projectId, {
      mode: "search",
      query: "pricing",
      limit: 3,
    }),
  ).toHaveLength(1);
  expect(
    await readPublishedMemory("owner", projectId, {
      mode: "search",
      query: "unrelated-secret-topic",
      limit: 3,
    }),
  ).toEqual([]);
  expect(
    await readPublishedMemory("owner", projectId, { mode: "none" }),
  ).toEqual([]);
});

it("leases classification so simultaneous reads make one provider call", async () => {
  const item = await recorded();
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  mocks.classify.mockImplementation(async () => {
    started();
    await waiting;
    return pillarId;
  });
  const first = enrichRecording("owner", item.id);
  await entered;
  await enrichRecording("owner", item.id);
  expect(mocks.classify).toHaveBeenCalledTimes(1);
  finish();
  await first;
  expect((await getContentItem("owner", item.id))?.pillarId).toBe(pillarId);
});

it("saves speech without spending when the router allowance is exhausted", async () => {
  const item = await recorded();
  mocks.allow.mockResolvedValue(false);
  await enrichRecording("owner", item.id);
  expect(mocks.classify).not.toHaveBeenCalled();
  expect((await getContentItem("owner", item.id))?.script).toBe(
    item.recordedTranscript,
  );
});

it("does not revive speech from a completed silent export", async () => {
  const item = await createContentItem("owner", {
    recordedTranscript: "",
    transcriptStatus: "ready",
    sourceTranscript: "Old speech",
    sourceUrl: "yapper://poster-upload",
  });
  await enrichRecording("owner", item.id);
  expect(await getContentItem("owner", item.id)).toMatchObject({
    script: null,
    recordedTranscript: "",
  });
  expect(mocks.classify).not.toHaveBeenCalled();
});

it("does not lose classification when publication changes status during the provider call", async () => {
  const item = await recorded();
  mocks.classify.mockImplementation(async () => {
    await updateContentItem("owner", item.id, { status: "posted" });
    return pillarId;
  });
  await enrichRecording("owner", item.id);
  expect((await getContentItem("owner", item.id))?.pillarId).toBe(pillarId);
});

it("a stale or foreign publication cannot mark someone else's item as posted", async () => {
  const item = await createContentItem("other", {
    title: "Private draft",
    status: "ready",
  });
  const [job] = await db
    .insert(schema.publishJobs)
    .values({
      userId: "owner",
      platform: "youtube",
      mediaKey: "u/owner/clip.mp4",
      contentItemId: item.id,
    })
    .returning();
  await completePublishJob(job.id, {
    externalPostId: "post",
    externalUrl: "https://example.com",
  });
  expect((await getContentItem("other", item.id))?.status).toBe("ready");
});
