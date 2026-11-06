import { afterEach, describe, expect, it, vi } from "vitest";
import { handPosterPrefill, takePosterPrefill } from "./chirpy-prefill";

afterEach(() => vi.unstubAllGlobals());

describe("Chirpy's Poster hand-over", () => {
  it("keeps only the latest, so one whose video never opened is dropped", () => {
    vi.stubGlobal("window", new EventTarget());
    handPosterPrefill({ videoID: "a", title: "Gym myths" });
    handPosterPrefill({ videoID: "b", title: "Desk tour" });
    expect(takePosterPrefill("a")).toBeUndefined();
    expect(takePosterPrefill("b")).toMatchObject({ title: "Desk tour" });
    expect(takePosterPrefill("b")).toBeUndefined();
  });
});
