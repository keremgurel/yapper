import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("publish idempotency schema", () => {
  it("adds the attempt key and enforces one job per user and platform", () => {
    const migration = readFileSync(
      "drizzle/0017_concerned_albert_cleary.sql",
      "utf8",
    );
    expect(migration).toContain(
      'ALTER TABLE "publish_jobs" ADD COLUMN "idempotency_key" text',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "publish_jobs_user_platform_idempotency_unique"',
    );
    expect(migration).toContain('("user_id","platform","idempotency_key")');
  });
});
