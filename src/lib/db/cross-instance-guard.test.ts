import { describe, expect, it, vi } from "vitest";
import { warnOnCrossInstanceDatabase } from "@/lib/db/cross-instance-guard";

const remote = "postgres://u:p@ep-soft-butterfly.neon.tech/neondb";

describe("warnOnCrossInstanceDatabase", () => {
  it("warns when dev Clerk keys meet a remote database", () => {
    const warn = vi.fn();
    expect(
      warnOnCrossInstanceDatabase(
        { CLERK_SECRET_KEY: "sk_test_x", DATABASE_URL: remote },
        warn,
      ),
    ).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("stays quiet for production keys", () => {
    const warn = vi.fn();
    expect(
      warnOnCrossInstanceDatabase(
        { CLERK_SECRET_KEY: "sk_live_x", DATABASE_URL: remote },
        warn,
      ),
    ).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet for a database on this machine", () => {
    const warn = vi.fn();
    expect(
      warnOnCrossInstanceDatabase(
        {
          CLERK_SECRET_KEY: "sk_test_x",
          DATABASE_URL: "postgres://u:p@localhost:5432/yapper",
        },
        warn,
      ),
    ).toBe(false);
  });

  it("can be silenced on purpose", () => {
    const warn = vi.fn();
    expect(
      warnOnCrossInstanceDatabase(
        {
          CLERK_SECRET_KEY: "sk_test_x",
          DATABASE_URL: remote,
          ALLOW_DEV_CLERK_ON_SHARED_DB: "1",
        },
        warn,
      ),
    ).toBe(false);
  });

  it("says nothing when the URL is unset or unparseable", () => {
    const warn = vi.fn();
    expect(
      warnOnCrossInstanceDatabase({ CLERK_SECRET_KEY: "sk_test_x" }, warn),
    ).toBe(false);
    expect(
      warnOnCrossInstanceDatabase(
        { CLERK_SECRET_KEY: "sk_test_x", DATABASE_URL: "not a url" },
        warn,
      ),
    ).toBe(false);
  });
});
