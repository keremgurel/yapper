import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { r2Objects, r2ObjectPurposes, r2ObjectStates } from "./schema";

const migrationPath = join(
  process.cwd(),
  "drizzle/0015_third_hellfire_club.sql",
);

describe("R2 object lifecycle schema", () => {
  it("models the complete upload and deletion lifecycle without a user FK", () => {
    const table = getTableConfig(r2Objects);
    const columns = new Map(
      table.columns.map((column) => [column.name, column]),
    );

    expect(r2ObjectPurposes).toEqual([
      "recording",
      "import",
      "thumbnail",
      "brand_logo",
    ]);
    expect(r2ObjectStates).toEqual([
      "pending_upload",
      "active",
      "delete_pending",
      "deleting",
      "deleted",
    ]);
    expect(columns.get("media_key")).toMatchObject({
      primary: true,
      notNull: true,
    });
    expect(columns.get("media_bytes")?.getSQLType()).toBe("bigint");
    expect(columns.get("attempts")).toMatchObject({
      notNull: true,
      hasDefault: true,
    });
    expect(table.foreignKeys).toHaveLength(0);
    expect(table.indexes.map((index) => index.config.name).sort()).toEqual([
      "r2_objects_state_attempt_idx",
      "r2_objects_user_state_idx",
    ]);
    expect(table.checks.map((check) => check.name).sort()).toEqual([
      "r2_objects_attempts_check",
      "r2_objects_deleted_at_check",
      "r2_objects_lease_check",
      "r2_objects_media_bytes_check",
      "r2_objects_purpose_check",
      "r2_objects_state_check",
      "r2_objects_upload_expiry_check",
    ]);
  });

  it("backfills only durable submission and import ownership", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain('FROM "submissions"');
    expect(migration).toContain('FROM "imported_platform_media"');
    expect(migration).toContain('WHERE "media_key" IS NOT NULL');
    expect(migration).toContain("bool_or(\"purpose\" = 'import')");
    expect(migration).toContain('max("media_bytes")');
    expect(migration).toContain("'active'");
    expect(migration).not.toContain('FROM "publish_jobs"');
  });
});
