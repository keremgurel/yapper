import { describe, expect, it } from "vitest";
import { insertDictation } from "@/components/ideas/insert-dictation";

describe("insertDictation", () => {
  it("splices spoken words in at the caret", () => {
    // "the cat| sat" -> speaking "black" belongs where the caret is.
    const out = insertDictation("the cat sat", "black", 7);
    expect(out.text).toBe("the cat black sat");
  });

  it("leaves the caret just past what was said", () => {
    const out = insertDictation("the cat sat", "black", 7);
    expect(out.text.slice(0, out.caret)).toBe("the cat black");
  });

  it("appends when the caret is at the end", () => {
    const out = insertDictation("first thought", "second thought", 13);
    expect(out.text).toBe("first thought second thought");
    expect(out.caret).toBe(out.text.length);
  });

  it("adds no leading space in an empty composer", () => {
    const out = insertDictation("", "hello there", 0);
    expect(out.text).toBe("hello there");
    expect(out.caret).toBe(11);
  });

  /** ASR returns bare words with no surrounding whitespace, so joining without
   * this gives "the catblack sat" on one side or a double space on the other,
   * depending purely on where the caret happened to be. */
  it("does not double up spacing the creator already typed", () => {
    expect(insertDictation("the cat ", "black", 8).text).toBe("the cat black");
    expect(insertDictation("the  sat", "black", 4).text).toBe("the black sat");
  });

  it("replaces a selection, the way typing over one does", () => {
    const out = insertDictation("the wrong word here", "right", 4, 15);
    expect(out.text).toBe("the right here");
  });

  /** The dictated clause belongs to the sentence that follows it, so it must
   * not be pushed away from its own punctuation. */
  it("does not put a space before punctuation", () => {
    expect(insertDictation("I think.", "really", 7).text).toBe(
      "I think really.",
    );
    expect(insertDictation("(x)", "y", 2).text).toBe("(x y)");
  });

  it("changes nothing when the transcript came back empty", () => {
    const out = insertDictation("kept", "   ", 2);
    expect(out.text).toBe("kept");
    expect(out.caret).toBe(2);
  });

  /** The caret is unknown until the textarea has been focused at least once,
   * and a stale one can outlive an edit that shortened the text. Appending is
   * the only safe guess. */
  it("appends when the caret is unknown or out of range", () => {
    expect(insertDictation("abc", "said", 99).text).toBe("abc said");
    expect(insertDictation("abc", "said", -1).text).toBe("abc said");
    expect(insertDictation("abc", "said", Number.NaN).text).toBe("abc said");
  });

  it("survives a selection end that trails behind its start", () => {
    const out = insertDictation("abcdef", "X", 4, 1);
    expect(out.text).toBe("abcd X ef");
  });
});
