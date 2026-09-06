import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updateProject: vi.fn(),
  replacePillars: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_a" }),
  currentUser: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({ ensureUser: vi.fn() }));
vi.mock("@/lib/db/project-seed", () => ({ seedPillarsIfEmpty: vi.fn() }));
vi.mock("@/lib/brain/context/server", () => ({
  invalidateBrainContext: vi.fn(),
}));
vi.mock("@/lib/db/projects", () => ({
  getActiveProject: async () => ({ id: "project_a", voice: "Old voice" }),
  updateProject: mocks.updateProject,
}));
vi.mock("@/lib/db/project-pillars", () => ({
  listPillars: async () => [],
  replacePillars: mocks.replacePillars,
}));
import { PATCH } from "./route";

const request = (body: object) =>
  new Request("https://ypr.app/api/project", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as NextRequest;

beforeEach(() => vi.clearAllMocks());
describe("project save confirmation", () => {
  it("does not report the old project as a successful write if the row disappears", async () => {
    mocks.updateProject.mockResolvedValue(null);
    const response = await PATCH(request({ voice: "New voice", pillars: [] }));
    expect(response.status).toBe(404);
    expect(mocks.replacePillars).not.toHaveBeenCalled();
  });
  it("confirms the stored reply, including deliberately cleared text", async () => {
    mocks.updateProject.mockResolvedValue({ id: "project_a", voice: "" });
    const response = await PATCH(request({ voice: "" }));
    expect(response.status).toBe(200);
    expect(mocks.updateProject).toHaveBeenCalledWith("user_a", { voice: "" });
    expect((await response.json()).project.voice).toBe("");
  });
});
