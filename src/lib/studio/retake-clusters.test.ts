import { describe, expect, it } from "vitest";
import { numberedTranscript } from "./retake-clusters";

describe("numberedTranscript", () => {
  it("indexes every word so the model can point at one", () => {
    expect(
      numberedTranscript([
        { text: "If" },
        { text: "you're" },
        { text: "here." },
      ]),
    ).toBe("0:If 1:you're 2:here.");
  });

  it("makes a long source pause visible without changing word indices", () => {
    expect(
      numberedTranscript([
        { text: "building", start: 0, end: 0.3 },
        { text: "this", start: 0.3, end: 0.6 },
        { text: "into", start: 7.4, end: 7.7 },
        { text: "a", start: 7.7, end: 7.9 },
        { text: "bigger", start: 7.9, end: 8.2 },
        { text: "thing.", start: 8.2, end: 8.5 },
      ]),
    ).toBe("0:building 1:this [pause=6.8s] 2:into 3:a 4:bigger 5:thing.");
  });
});
