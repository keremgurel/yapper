import { describe, expect, it, vi } from "vitest";

import { PublishAttempt, PublishAttemptRegistry } from "./attempt";

describe("PublishAttempt", () => {
  it("reuses one key after a failed or ambiguous request", () => {
    const createKey = vi.fn().mockReturnValue("attempt_1");
    const attempt = new PublishAttempt(createKey);

    expect(attempt.begin()).toBe("attempt_1");
    attempt.finish();
    expect(attempt.begin()).toBe("attempt_1");
    expect(createKey).toHaveBeenCalledOnce();
  });

  it("rejects overlapping clicks and rotates only after an explicit reset", () => {
    const createKey = vi
      .fn()
      .mockReturnValueOnce("attempt_1")
      .mockReturnValueOnce("attempt_2");
    const attempt = new PublishAttempt(createKey);

    expect(attempt.begin()).toBe("attempt_1");
    expect(attempt.begin()).toBeNull();
    attempt.finish();
    attempt.reset();
    expect(attempt.begin()).toBe("attempt_2");
  });
});

describe("PublishAttemptRegistry", () => {
  it("keeps one key per source and destination for the sheet lifetime", () => {
    const createKey = vi
      .fn()
      .mockReturnValueOnce("youtube_1")
      .mockReturnValueOnce("instagram_1");
    const attempts = new PublishAttemptRegistry(createKey);

    expect(attempts.forTarget("source_1:youtube")).toBe("youtube_1");
    expect(attempts.forTarget("source_1:youtube")).toBe("youtube_1");
    expect(attempts.forTarget("source_1:instagram")).toBe("instagram_1");
    expect(createKey).toHaveBeenCalledTimes(2);
  });
});
