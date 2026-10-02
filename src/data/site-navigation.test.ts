import { describe, expect, it } from "vitest";
import {
  isPanel,
  siteContextFor,
  siteNavigation,
  type NavItem,
} from "./site-navigation";

const hrefs = (items: NavItem[]) =>
  items.flatMap((item) =>
    isPanel(item)
      ? [
          item.footer.href,
          ...item.columns.flatMap((c) => c.links.map((l) => l.href)),
        ]
      : [item.href],
  );

describe("site context", () => {
  it("puts product pages in their product and everything else on the brand", () => {
    expect(siteContextFor("/")).toBe("brand");
    expect(siteContextFor("/pricing")).toBe("brand");
    expect(siteContextFor("/products/studio/pricing")).toBe("studio");
    expect(siteContextFor("/features/ai-script-writer")).toBe("studio");
    expect(siteContextFor("/products/train/ai-feedback")).toBe("train");
    expect(siteContextFor("/training/interview-prep")).toBe("train");
    expect(siteContextFor("/blog/overcome-filler-words")).toBe("train");
    // A prefix is a path segment, not a string prefix.
    expect(siteContextFor("/trainingwheels")).toBe("brand");
  });
});

describe("product navigation", () => {
  it("never links a product's menu into the other product", () => {
    const studio = hrefs(siteNavigation.studio.items);
    const train = hrefs(siteNavigation.train.items);
    expect(studio.every((href) => siteContextFor(href) === "studio")).toBe(
      true,
    );
    expect(train.every((href) => siteContextFor(href) === "train")).toBe(true);
  });
  it("offers exactly one way across, to the other product's overview", () => {
    expect(siteNavigation.studio.switchTo?.href).toBe("/products/train");
    expect(siteNavigation.train.switchTo?.href).toBe("/products/studio");
    expect(siteNavigation.brand.switchTo).toBeUndefined();
  });
  it("sends each product's pricing link to its own pricing page", () => {
    expect(hrefs(siteNavigation.studio.items)).toContain(
      "/products/studio/pricing",
    );
    expect(hrefs(siteNavigation.train.items)).toContain(
      "/products/train/pricing",
    );
  });
});
