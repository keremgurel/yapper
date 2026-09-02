import { describe, expect, it } from "vitest";
import { numberedTranscript, retakeCutsFromResponse } from "./retake-clusters";

const answer = (blocks: unknown) => JSON.stringify({ blocks });

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

describe("retakeCutsFromResponse", () => {
  it("takes the deletions a cluster asks for", () => {
    const cuts = retakeCutsFromResponse(
      answer([
        {
          keep: [[10, 19]],
          drop: [
            [0, 4],
            [5, 9],
          ],
        },
      ]),
      20,
    );
    expect(cuts).toEqual([
      [0, 4],
      [5, 9],
    ]);
  });

  it("reads an answer wrapped in prose or a code fence", () => {
    const cuts = retakeCutsFromResponse(
      "Here is the edit:\n```json\n" +
        answer([{ keep: [[5, 9]], drop: [[0, 4]] }]) +
        "\n```",
      10,
    );
    expect(cuts).toEqual([[0, 4]]);
  });

  it("allows clean source spans on both sides of a false start", () => {
    expect(
      retakeCutsFromResponse(
        answer([
          {
            keep: [
              [0, 3],
              [8, 12],
            ],
            drop: [[4, 7]],
          },
        ]),
        13,
      ),
    ).toEqual([[4, 7]]);
  });

  it("keeps everything when no line was said twice", () => {
    expect(retakeCutsFromResponse(answer([]), 20)).toEqual([]);
  });

  it("refuses a cluster that deletes its own survivor", () => {
    expect(
      retakeCutsFromResponse(answer([{ keep: [[5, 9]], drop: [[0, 12]] }]), 20),
    ).toBeNull();
  });

  it("refuses one cluster deleting what another one keeps", () => {
    expect(
      retakeCutsFromResponse(
        answer([
          { keep: [[0, 4]], drop: [] },
          { keep: [[10, 14]], drop: [[3, 6]] },
        ]),
        20,
      ),
    ).toBeNull();
  });

  it("refuses overlapping deletions", () => {
    expect(
      retakeCutsFromResponse(
        answer([
          {
            keep: [[15, 19]],
            drop: [
              [0, 6],
              [4, 9],
            ],
          },
        ]),
        20,
      ),
    ).toBeNull();
  });

  it("refuses an index that is not in the transcript", () => {
    expect(
      retakeCutsFromResponse(answer([{ keep: [[0, 4]], drop: [[5, 99]] }]), 20),
    ).toBeNull();
    expect(
      retakeCutsFromResponse(answer([{ keep: [[0, 4]], drop: [[9, 5]] }]), 20),
    ).toBeNull();
  });

  it("refuses an answer that would delete the video", () => {
    expect(
      retakeCutsFromResponse(
        answer([{ keep: [[99, 99]], drop: [[0, 98]] }]),
        100,
      ),
    ).toBeNull();
  });

  it("refuses anything that is not the shape it asked for", () => {
    expect(retakeCutsFromResponse("no json here", 20)).toBeNull();
    expect(retakeCutsFromResponse("{ not json", 20)).toBeNull();
    expect(retakeCutsFromResponse(JSON.stringify({}), 20)).toBeNull();
    expect(retakeCutsFromResponse(answer([{ keep: [[0, 4]] }]), 20)).toBeNull();
    expect(retakeCutsFromResponse(answer([{ drop: [[0, 4]] }]), 20)).toBeNull();
    expect(
      retakeCutsFromResponse(answer([{ keep: [0, 4], drop: [[5, 9]] }]), 20),
    ).toBeNull();
    expect(
      retakeCutsFromResponse(answer([{ keep: [], drop: [[5, 9]] }]), 20),
    ).toBeNull();
  });
});
