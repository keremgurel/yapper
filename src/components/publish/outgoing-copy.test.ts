import { describe, expect, it } from "vitest";
import type { CrossPostTarget } from "@/components/publish/compose/types";
import {
  hasPreparedCaptions,
  outgoingCopy,
} from "@/components/publish/outgoing-copy";

const source = (over: Partial<CrossPostTarget> = {}): CrossPostTarget => ({
  id: "v1",
  title: "Fallback title",
  ...over,
});

describe("outgoingCopy", () => {
  it("uses the prepared caption, rendered exactly as the creator saw it", () => {
    const copy = outgoingCopy(
      source({
        captions: {
          instagram: {
            platform: "instagram",
            title: "",
            body: "The hook line.",
            hashtags: ["run", "pace"],
          },
        },
      }),
      "instagram",
      null,
    );
    expect(copy.body).toBe("The hook line.\n\n#run #pace");
  });

  it("keeps each platform on its own caption", () => {
    const target = source({
      captions: {
        youtube: {
          platform: "youtube",
          title: "How I fixed my pace",
          body: "Long form context.",
          hashtags: [],
        },
        tiktok: {
          platform: "tiktok",
          title: "",
          body: "one line, spoken",
          hashtags: [],
        },
      },
    });
    expect(outgoingCopy(target, "youtube", null).title).toBe(
      "How I fixed my pace",
    );
    expect(outgoingCopy(target, "youtube", null).body).toBe(
      "Long form context.",
    );
    expect(outgoingCopy(target, "tiktok", null).body).toBe("one line, spoken");
  });

  it("prefers a prepared caption over the sheet's own fields", () => {
    const copy = outgoingCopy(
      source({
        captions: {
          instagram: {
            platform: "instagram",
            title: "",
            body: "Prepared.",
            hashtags: [],
          },
        },
      }),
      "instagram",
      { title: "Typed", caption: "Typed caption" },
    );
    expect(copy.body).toBe("Prepared.");
  });

  it("falls back to the sheet's fields when nothing was prepared", () => {
    const copy = outgoingCopy(source(), "youtube", {
      title: "  Typed  ",
      caption: "  Typed caption  ",
    });
    expect(copy).toEqual({ title: "Typed", body: "Typed caption" });
  });

  it("falls back to the target's own title when every field is empty", () => {
    expect(outgoingCopy(source(), "youtube", null)).toEqual({
      title: "Fallback title",
      body: "",
    });
  });

  it("keeps the initial copy prepared by older surfaces", () => {
    const copy = outgoingCopy(
      source({ initialTitle: "Cover text", initialDescription: "A caption." }),
      "instagram",
      null,
    );
    expect(copy).toEqual({ title: "Cover text", body: "A caption." });
  });
});

describe("hasPreparedCaptions", () => {
  it("is false for an empty caption set", () => {
    expect(hasPreparedCaptions([source({ captions: {} })])).toBe(false);
  });

  it("is true as soon as one source carries one platform", () => {
    expect(
      hasPreparedCaptions([
        source(),
        source({
          id: "v2",
          captions: {
            tiktok: {
              platform: "tiktok",
              title: "",
              body: "hi",
              hashtags: [],
            },
          },
        }),
      ]),
    ).toBe(true);
  });
});
