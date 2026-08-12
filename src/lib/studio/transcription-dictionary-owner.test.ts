import { describe, expect, it } from "vitest";
import {
  DICTIONARY_OWNER_HEADER,
  hasExpectedDictionaryOwner,
} from "./transcription-dictionary-owner";

describe("hasExpectedDictionaryOwner", () => {
  it("accepts the account that initiated the request", () => {
    const request = new Request(
      "https://ypr.app/api/transcription-dictionary",
      {
        headers: { [DICTIONARY_OWNER_HEADER]: "user_A" },
      },
    );
    expect(hasExpectedDictionaryOwner(request, "user_A")).toBe(true);
  });

  it("allows native requests without an assertion but rejects a stale one", () => {
    expect(
      hasExpectedDictionaryOwner(
        new Request("https://ypr.app/api/transcription-dictionary"),
        "user_A",
      ),
    ).toBe(true);
    expect(
      hasExpectedDictionaryOwner(
        new Request("https://ypr.app/api/transcription-dictionary", {
          headers: { [DICTIONARY_OWNER_HEADER]: "user_A" },
        }),
        "user_B",
      ),
    ).toBe(false);
  });
});
