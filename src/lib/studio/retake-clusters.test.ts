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

  function attempts(last: string, gap = 1) {
    let time = 0;
    const words = (text: string, pause: number) => {
      time += pause;
      return text.split(" ").map((text) => {
        const start = time;
        time += 0.2;
        return { text, start, end: time };
      });
    };
    return [
      ...words("And right now we're", 0),
      ...words("And right now we're at $400 in sales today.", 1),
      ...words("And right now we're a", gap),
      ...words(last, 0.6),
    ];
  }

  it("identifies the final delivery after an abandoned opening", () => {
    const text = numberedTranscript(
      attempts("and right now we're at $400 in sales today."),
    );
    expect(text).toContain("[pause=0.6s] 18:and");
    expect(text).toContain(
      "Earlier delivery 4-12; abandoned opening 13-17; final complete delivery 18-26.",
    );
  });

  it("leaves distinct statements and incomplete restarts to the editor", () => {
    for (const words of [
      attempts("and right now we're at $500 in sales today."),
      attempts("and right now we're owed $400 by suppliers today."),
      attempts("and right now we're at $400 in sales..."),
      attempts("and right now we're at $400 in sales today.", 65),
    ]) {
      expect(numberedTranscript(words)).not.toContain("Earlier delivery");
    }
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
