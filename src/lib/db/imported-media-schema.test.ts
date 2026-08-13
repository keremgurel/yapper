import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { importedPlatformMedia } from "./schema";

describe("imported platform media storage schema", () => {
  it("requires a bigint byte count with a zero migration default", () => {
    const table = getTableConfig(importedPlatformMedia);
    const mediaBytes = table.columns.find(
      (column) => column.name === "media_bytes",
    );

    expect(mediaBytes).toMatchObject({ notNull: true, hasDefault: true });
    expect(mediaBytes?.getSQLType()).toBe("bigint");

    const migration = readFileSync(
      join(process.cwd(), "drizzle/0014_cloudy_metal_master.sql"),
      "utf8",
    );
    expect(migration).toContain(
      'ADD COLUMN "media_bytes" bigint DEFAULT 0 NOT NULL',
    );
  });
});
