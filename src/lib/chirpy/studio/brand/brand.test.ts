import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioActionContext } from "../executor";

const mocks = vi.hoisted(() => ({
  getActiveProject: vi.fn(),
  saveBrandColors: vi.fn(),
  listBrandAssets: vi.fn(),
  makePrimaryBrandAsset: vi.fn(),
  deleteBrandLogo: vi.fn(),
}));
vi.mock("@/lib/db/projects", () => ({
  getActiveProject: mocks.getActiveProject,
}));
vi.mock("@/lib/brand/operations/save-colors", () => ({
  saveBrandColors: mocks.saveBrandColors,
}));
vi.mock("@/lib/db/brand", () => ({
  listBrandAssets: mocks.listBrandAssets,
  makePrimaryBrandAsset: mocks.makePrimaryBrandAsset,
}));
vi.mock("@/lib/brand/operations/delete-logo", () => ({
  deleteBrandLogo: mocks.deleteBrandLogo,
}));

import { colorsAction, nextPalette } from "./colors";
import { deleteLogoAction, makePrimaryLogoAction } from "./logos";
import { wantsBrand } from "./reads";

const LOGO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
} satisfies StudioActionContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveProject.mockResolvedValue({
    brandColors: ["#FF7A21", "#151515"],
  });
  mocks.saveBrandColors.mockImplementation(async (_user, colors) => ({
    ok: true,
    value: colors,
  }));
  mocks.listBrandAssets.mockResolvedValue([
    { id: LOGO, name: "Wordmark.svg", isPrimary: false },
  ]);
});

describe("nextPalette", () => {
  const current = ["#FF7A21", "#151515"];
  it.each([
    ["set", ["#008080"], ["#008080"]],
    ["add", ["#008080", "#FF7A21"], ["#FF7A21", "#151515", "#008080"]],
    ["remove", ["#151515"], ["#FF7A21"]],
    ["primary", ["#151515"], ["#151515", "#FF7A21"]],
    ["primary", ["#008080"], ["#008080", "#FF7A21", "#151515"]],
  ] as const)("%s %j", (operation, colors, expected) => {
    expect(nextPalette(operation, colors, current)).toEqual(expected);
  });
});

describe("studio.brand.colors", () => {
  it("normalizes names and applies the change to the saved palette", async () => {
    const outcome = await colorsAction.run(
      { operation: "add", colors: ["teal", "#ff7a21"] },
      context,
    );
    expect(mocks.saveBrandColors).toHaveBeenCalledWith("user_1", [
      "#FF7A21",
      "#151515",
      "#008080",
    ]);
    expect(outcome).toEqual({
      summary: "Brand colors are now #FF7A21 (primary), #151515, #008080.",
      effects: ["brand"],
    });
  });

  it("refuses a shade it cannot save exactly, before any write", async () => {
    await expect(
      colorsAction.run(
        { operation: "add", colors: ["sunset orange"] },
        context,
      ),
    ).rejects.toMatchObject({ code: "bad_color" });
    expect(mocks.saveBrandColors).not.toHaveBeenCalled();
  });

  it("refuses a ninth color", async () => {
    mocks.getActiveProject.mockResolvedValue({
      brandColors: Array.from({ length: 8 }, (_, index) => `#00000${index}`),
    });
    await expect(
      colorsAction.run({ operation: "add", colors: ["teal"] }, context),
    ).rejects.toMatchObject({ code: "color_limit" });
  });

  it("changes nothing when the color to remove is not there", async () => {
    const outcome = await colorsAction.run(
      { operation: "remove", colors: ["teal"] },
      context,
    );
    expect(mocks.saveBrandColors).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      summary: "#008080 wasn’t in your kit, so nothing changed.",
      effects: [],
    });
  });

  it("clears the palette with an empty set", async () => {
    const outcome = await colorsAction.run(
      { operation: "set", colors: [] },
      context,
    );
    expect(outcome.summary).toBe("Cleared your brand colors.");
  });
});

describe("logo actions", () => {
  it("makes a logo primary by id", async () => {
    mocks.makePrimaryBrandAsset.mockResolvedValue(true);
    const outcome = await makePrimaryLogoAction.run({ logoID: LOGO }, context);
    expect(mocks.makePrimaryBrandAsset).toHaveBeenCalledWith("user_1", LOGO);
    expect(outcome.summary).toBe("Made “Wordmark.svg” your primary logo.");
  });

  it("reports a logo that is already gone without deleting anything", async () => {
    mocks.listBrandAssets.mockResolvedValue([]);
    await expect(
      deleteLogoAction.run({ logoID: LOGO }, context),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(mocks.deleteBrandLogo).not.toHaveBeenCalled();
  });

  it("deletes through the logo card's operation and names it in the question", async () => {
    mocks.deleteBrandLogo.mockResolvedValue({ ok: true, value: null });
    const outcome = await deleteLogoAction.run({ logoID: LOGO }, context);
    expect(outcome).toEqual({
      summary: "Deleted the “Wordmark.svg” logo.",
      effects: ["brand"],
    });
    expect(
      deleteLogoAction.describe!(
        { logoID: LOGO },
        {
          ideas: {},
          views: {},
          pillars: {},
          logos: { [LOGO]: "Wordmark.svg" },
        },
      ),
    ).toBe("Delete the “Wordmark.svg” logo");
  });
});

describe("wantsBrand", () => {
  it.each([
    ["/studio/brand", "make the wordmark primary", true],
    ["/studio/ideas", "change my brand color to teal", true],
    ["/studio/ideas", "add #1a7f7a", true],
    ["/studio/ideas", "make an idea about gym myths", false],
    ["/studio/calendar", "move it to Friday", false],
  ])("%s %s", (surface, request, expected) => {
    expect(wantsBrand(surface, request)).toBe(expected);
  });
});
