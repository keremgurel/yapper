import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPillars: vi.fn(),
  ensurePillars: vi.fn(),
  legacyRows: [] as { pillar: string | null }[],
}));

vi.mock("./project-pillars", () => ({
  listPillars: mocks.listPillars,
  ensurePillars: mocks.ensurePillars,
}));
vi.mock("./client", () => ({
  getDb: () => ({
    selectDistinct: () => ({
      from: () => ({ where: async () => mocks.legacyRows }),
    }),
  }),
}));

import { listPillarsSeeded } from "./project-seed";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.legacyRows = [];
  mocks.ensurePillars.mockResolvedValue(undefined);
});

describe("listPillarsSeeded", () => {
  it("never asks for onboarding pillars once the project has pillars", async () => {
    mocks.listPillars.mockResolvedValue([{ id: "p1", name: "Tips" }]);
    const onboarding = vi.fn(async () => ["Ignored"]);

    const pillars = await listPillarsSeeded("user_a", "project_a", onboarding);

    expect(pillars).toEqual([{ id: "p1", name: "Tips" }]);
    expect(onboarding).not.toHaveBeenCalled();
    expect(mocks.ensurePillars).not.toHaveBeenCalled();
  });

  it("seeds an empty project from onboarding first, then legacy pillars", async () => {
    mocks.listPillars
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "p1", name: "Stories" }]);
    mocks.legacyRows = [{ pillar: "Tips" }];

    const pillars = await listPillarsSeeded("user_b", "project_b", async () => [
      "Stories",
    ]);

    expect(mocks.ensurePillars).toHaveBeenCalledWith("project_b", [
      "Stories",
      "Tips",
    ]);
    expect(pillars).toEqual([{ id: "p1", name: "Stories" }]);
  });

  it("looks up onboarding only once for a project with nothing to seed", async () => {
    mocks.listPillars.mockResolvedValue([]);
    const onboarding = vi.fn(async () => []);

    await listPillarsSeeded("user_c", "project_c", onboarding);
    await listPillarsSeeded("user_c", "project_c", onboarding);

    expect(onboarding).toHaveBeenCalledOnce();
    expect(mocks.ensurePillars).not.toHaveBeenCalled();
  });
});
