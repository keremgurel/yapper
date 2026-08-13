import { describe, expect, it } from "vitest";
import {
  MAX_CLEAN_TRANSCRIPT_CHARS,
  MAX_CLEAN_TRANSCRIPT_WORDS,
  parseCleanTranscriptWords,
} from "@/lib/studio/clean-transcript-input";

describe("parseCleanTranscriptWords", () => {
  it("accepts a bounded transcript and drops unknown fields", () => {
    expect(parseCleanTranscriptWords([{ text: "hello", start: 0 }])).toEqual([
      { text: "hello" },
    ]);
  });

  it("rejects malformed and overlong words", () => {
    expect(parseCleanTranscriptWords([{ text: 1 }])).toBeNull();
    expect(parseCleanTranscriptWords([{ text: "   " }])).toBeNull();
    expect(parseCleanTranscriptWords([{ text: "x".repeat(81) }])).toBeNull();
  });

  it("rejects excessive word and aggregate character counts", () => {
    expect(
      parseCleanTranscriptWords(
        Array.from({ length: MAX_CLEAN_TRANSCRIPT_WORDS + 1 }, () => ({
          text: "x",
        })),
      ),
    ).toBeNull();
    expect(
      parseCleanTranscriptWords(
        Array.from({ length: MAX_CLEAN_TRANSCRIPT_CHARS / 60 + 1 }, () => ({
          text: "x".repeat(60),
        })),
      ),
    ).toBeNull();
  });
});
