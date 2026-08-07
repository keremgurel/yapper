import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveProject = vi.fn();
const pillarsByIds = vi.fn();

vi.mock("@/lib/db/projects", () => ({
  getActiveProject: (...args: unknown[]) => getActiveProject(...args),
}));
vi.mock("@/lib/db/project-pillars", () => ({
  pillarsByIds: (...args: unknown[]) => pillarsByIds(...args),
}));

import { resolveOwnPillar } from "./pillar-ownership";

describe("resolveOwnPillar", () => {
  beforeEach(() => {
    getActiveProject.mockReset().mockResolvedValue({ id: "project-1" });
    pillarsByIds.mockReset().mockResolvedValue([]);
  });

  it("accepts a pillar the caller owns", async () => {
    pillarsByIds.mockResolvedValue([{ id: "pillar-1", name: "The grind" }]);

    await expect(resolveOwnPillar("user-1", "pillar-1")).resolves.toEqual({
      ok: true,
      pillarId: "pillar-1",
    });
    expect(pillarsByIds).toHaveBeenCalledWith("project-1", ["pillar-1"]);
  });

  /** The foreign key proves the pillar exists, not whose it is. A uuid from
   * another creator's project must not become a link, or its name would be
   * read straight back out of the item list. */
  it("rejects a pillar belonging to someone else", async () => {
    pillarsByIds.mockResolvedValue([]);

    await expect(resolveOwnPillar("user-1", "someone-elses")).resolves.toEqual({
      ok: false,
    });
  });

  it("treats null as clearing the classification", async () => {
    await expect(resolveOwnPillar("user-1", null)).resolves.toEqual({
      ok: true,
      pillarId: null,
    });
    expect(getActiveProject).not.toHaveBeenCalled();
  });

  it("rejects a non-string id rather than coercing it", async () => {
    await expect(resolveOwnPillar("user-1", 42)).resolves.toEqual({
      ok: false,
    });
  });
});
