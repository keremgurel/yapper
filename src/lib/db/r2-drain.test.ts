import { describe, expect, it } from "vitest";

import { drainR2AfterResponse } from "@/lib/db/r2-drain";

describe("drainR2AfterResponse", () => {
  it("never throws when there is no request scope", () => {
    // Route handlers are called directly by tests and scripts, where `after`
    // rejects for lack of a request. Scheduling the courtesy drain must not
    // turn that into a failed delete: the object is already enqueued and the
    // scheduled sweep is what actually guarantees it goes away.
    expect(() => drainR2AfterResponse()).not.toThrow();
  });
});
