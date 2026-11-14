import { describe, expect, it } from "vitest";
import { applyPosterGeneration, posterCaptions } from "./poster-copy";

describe("Poster copy", () => {
  it("shares text without replacing an account override or the YouTube title", () => {
    const copy = posterCaptions(
      {
        caption: "Shared",
        title: "A title",
        overrides: { instagram: "For Instagram" },
      },
      "Original",
    );
    expect(copy.youtube).toMatchObject({ title: "A title", body: "Shared" });
    expect(copy.instagram?.body).toBe("For Instagram");
    expect(copy.tiktok?.body).toBe("Shared");
  });

  it("fills the title while preserving a caption edited during generation", () => {
    const next = applyPosterGeneration(
      { caption: "Typed while waiting" },
      "Original",
      { caption: "Original", title: "" },
      { caption: "AI caption", title: "AI title" },
    );
    expect(next).toMatchObject({
      caption: "Typed while waiting",
      title: "AI title",
      before: { caption: "Typed while waiting" },
    });
  });

  it("keeps the manual title and allows restoring the original caption", () => {
    const next = applyPosterGeneration(
      { title: "My title" },
      "Original",
      { caption: "Original", title: "My title" },
      { caption: "AI caption", title: "AI title" },
    );
    expect(posterCaptions(next, "Original").youtube?.title).toBe("My title");
    expect(
      posterCaptions({ ...next, ...next.before }, "Original").youtube?.body,
    ).toBe("Original");
  });
});
