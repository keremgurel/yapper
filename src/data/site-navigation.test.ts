import { describe, expect, it } from "vitest";
import { isPanel, siteContextFor, siteNavigation } from "./site-navigation";

describe("Studio public site", () => {
  it.each([
    "/",
    "/pricing",
    "/blog",
    "/blog/overcome-filler-words",
    "/features/ai-script-writer",
    "/products/studio/pricing",
    null,
  ])("uses Studio navigation at %s", (path) => {
    expect(siteContextFor(path)).toBe("studio");
  });
  it("keeps legacy coaching routes in their billing context", () => {
    expect(siteContextFor("/products/train/ai-feedback")).toBe("train");
    expect(siteContextFor("/training/interview-prep")).toBe("train");
    expect(siteContextFor("/trainingwheels")).toBe("studio");
  });
  it("has one pricing destination and keeps the blog discoverable", () => {
    const links = siteNavigation.studio.items.filter((item) => !isPanel(item));
    expect(links).toContainEqual({ label: "Pricing", href: "/pricing" });
    expect(links).toContainEqual({ label: "Blog", href: "/blog" });
    expect(siteNavigation.studio.cta?.href).toBe("/pricing");
    expect(siteNavigation.studio.switchTo).toBeUndefined();
    expect(siteNavigation.studio.product?.href).toBe("/");
  });
});
