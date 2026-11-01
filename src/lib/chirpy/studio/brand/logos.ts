import type { BrandLogoInput } from "../../../../../protocol/app-actions.generated";
import { deleteBrandLogo } from "@/lib/brand/operations/delete-logo";
import { listBrandAssets, makePrimaryBrandAsset } from "@/lib/db/brand";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

async function logoName(userId: string, id: string) {
  return (await listBrandAssets(userId)).find((asset) => asset.id === id)?.name;
}

/** The logo card's "Make primary". */
export const makePrimaryLogoAction: StudioActionDefinition<BrandLogoInput> = {
  async run({ logoID }, { userId }) {
    const name = await logoName(userId, logoID);
    if (!name || !(await makePrimaryBrandAsset(userId, logoID)))
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that logo. It may have been deleted.",
      );
    return { summary: `Made “${name}” your primary logo.`, effects: ["brand"] };
  },
};

/** Runs only after the creator confirms, through the logo card's delete. */
export const deleteLogoAction: StudioActionDefinition<BrandLogoInput> = {
  async run({ logoID }, { userId }) {
    const name = await logoName(userId, logoID);
    const removed = name ? await deleteBrandLogo(userId, logoID) : null;
    if (!removed?.ok)
      throw new StudioActionFailure(
        "not_found",
        "That logo was already gone, so nothing was deleted.",
      );
    return { summary: `Deleted the “${name}” logo.`, effects: ["brand"] };
  },
  describe({ logoID }, names) {
    const name = names.logos?.[logoID];
    return name ? `Delete the “${name}” logo` : "Delete that logo";
  },
};
