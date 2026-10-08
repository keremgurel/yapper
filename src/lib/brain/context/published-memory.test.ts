import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pillars: vi.fn(),
  read: vi.fn(),
  plan: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/db/project-pillars", () => ({ listPillars: mocks.pillars }));
vi.mock("@/lib/db/published-memory", () => ({
  readPublishedMemory: mocks.read,
}));
vi.mock("@/lib/provider-rate-limit", () => ({ guardRouterSpend: mocks.allow }));
vi.mock("./published-memory-plan", async (original) => ({
  ...(await original<object>()),
  planPublishedMemory: mocks.plan,
}));
import {
  publishedMemoryContext,
  clearPublishedMemoryPlans,
} from "./published-memory";
import { memoryPlanByRules, parseMemoryPlan } from "./published-memory-plan";
const pillars = [
  {
    id: "ship",
    name: "Ship log",
    description: "Building in public",
    examples: [],
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  clearPublishedMemoryPlans();
  vi.stubEnv("SURPLUS_API_KEY", "test-key");
  mocks.pillars.mockResolvedValue(pillars);
  mocks.allow.mockResolvedValue(true);
  mocks.read.mockResolvedValue([
    { id: "a", title: "ep14", script: "My words", truncated: false },
  ]);
  mocks.plan.mockResolvedValue({ mode: "none" });
});
it("does no catalogue, script or provider work without an opt-in request", async () => {
  expect(await publishedMemoryContext("owner", "project")).toEqual({
    section: "",
    used: [],
  });
  expect(mocks.pillars).not.toHaveBeenCalled();
  expect(mocks.plan).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
});
it("reads no ideas for an unrelated request", async () => {
  await publishedMemoryContext(
    "owner",
    "project",
    "How do I change my settings?",
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
it("retrieves a bounded plan and discloses only the references actually read", async () => {
  mocks.plan.mockResolvedValue({ mode: "pillar", pillarId: "ship", limit: 2 });
  const result = await publishedMemoryContext(
    "owner",
    "project",
    "Write a shiplog idea using my last two posts",
  );
  expect(mocks.read).toHaveBeenCalledWith("owner", "project", {
    mode: "pillar",
    pillarId: "ship",
    limit: 2,
  });
  expect(result.used).toEqual(["Posted script: ep14"]);
  expect(result.section).toContain("untrusted reference material");
  expect(result.section).toContain("My words");
});
it("falls back narrowly on router failure, and never broadens a missing specific post", async () => {
  mocks.plan.mockRejectedValueOnce(new Error("timeout"));
  await publishedMemoryContext("owner", "project", "Write a new shiplog idea");
  expect(mocks.read).toHaveBeenCalledWith("owner", "project", {
    mode: "pillar",
    pillarId: "ship",
    limit: 3,
  });
  mocks.read.mockClear().mockResolvedValue([]);
  mocks.plan.mockResolvedValue({ mode: "title", query: "ep14", limit: 1 });
  const result = await publishedMemoryContext(
    "owner",
    "project",
    "Sound like ep14",
  );
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(result.used).toEqual([]);
  expect(result.section).toContain("No matching published scripts");
});
it("guards routing replies and conservative fallback", () => {
  expect(
    parseMemoryPlan(
      { mode: "pillar", pillarId: "other-owner", limit: 100 },
      pillars,
    ),
  ).toEqual({ mode: "none" });
  expect(
    parseMemoryPlan({ mode: "search", query: "pricing", limit: 99 }, pillars),
  ).toEqual({ mode: "search", query: "pricing", limit: 3 });
  expect(
    parseMemoryPlan({ mode: "title", query: "ep14", limit: 3 }, pillars),
  ).toEqual({ mode: "title", query: "ep14", limit: 1 });
  expect(memoryPlanByRules("Write a new shiplog idea", pillars)).toMatchObject({
    mode: "pillar",
    limit: 3,
  });
  expect(
    memoryPlanByRules("Write a ship log without using past posts", pillars),
  ).toEqual({ mode: "none" });
  expect(memoryPlanByRules("Rename my Ship log pillar", pillars)).toEqual({
    mode: "none",
  });
});

it("caches selection only, re-reading current scripts and isolating accounts", async () => {
  mocks.plan.mockResolvedValue({ mode: "pillar", pillarId: "ship", limit: 3 });
  await publishedMemoryContext("owner", "project", "Write a Ship log idea");
  await publishedMemoryContext("owner", "project", "Write a Ship log idea");
  expect(mocks.plan).toHaveBeenCalledTimes(1);
  expect(mocks.read).toHaveBeenCalledTimes(2);
  await publishedMemoryContext("other", "project", "Write a Ship log idea");
  expect(mocks.plan).toHaveBeenCalledTimes(2);
});
