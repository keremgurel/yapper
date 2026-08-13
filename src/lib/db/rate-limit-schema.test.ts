import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { rateLimitBuckets } from "./schema";

describe("durable rate-limit schema", () => {
  it("uses an opaque scope/subject primary key without a user foreign key", () => {
    const config = getTableConfig(rateLimitBuckets);
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.primaryKeys[0].columns.map((column) => column.name)).toEqual([
      "scope",
      "subject_hash",
    ]);
    expect(config.foreignKeys).toHaveLength(0);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "rate_limit_buckets_expiry_idx",
    );
  });

  it("migrates token invariants and the cleanup index", () => {
    const migration = readFileSync(
      join(process.cwd(), "drizzle/0016_groovy_roland_deschain.sql"),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "rate_limit_buckets"');
    expect(migration).toContain('PRIMARY KEY("scope","subject_hash")');
    expect(migration).toContain('"tokens" >= 0');
    expect(migration).toContain('"tokens" <= "rate_limit_buckets"."capacity"');
    expect(migration).toContain('"capacity" > 0');
    expect(migration).toContain('"refill_per_second" > 0');
    expect(migration).toContain('"rate_limit_buckets_expiry_idx"');
  });
});
