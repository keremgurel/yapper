import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STARTER_SKILL_SLUGS } from "@/lib/brain/default-skills";

describe("format skills migration", () => {
  const migration = readFileSync("drizzle/0030_format_skills.sql", "utf8");

  it("adds formats to the catalog and two format-limited starters", () => {
    expect(migration).toContain(
      `ALTER TABLE "skill_catalog" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL`,
    );
    expect(migration).toContain(`'["long"]'::jsonb`);
    expect(migration).toContain(`'["article"]'::jsonb`);
    expect(STARTER_SKILL_SLUGS).toEqual(
      expect.arrayContaining(["chapters-that-hold", "skimmable-sections"]),
    );
  });

  it("never overwrites a catalog edit or a project's own copy", () => {
    expect(migration).toContain('ON CONFLICT ("slug") DO NOTHING');
    expect(migration).toContain(
      'ON CONFLICT ("project_id","catalog_slug") DO NOTHING',
    );
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b/i);
  });

  it("writes no em or en dashes into skill text", () => {
    expect(migration).not.toMatch(/[—–]/);
  });

  it("is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(
      expect.objectContaining({ idx: 30, tag: "0030_format_skills" }),
    );
  });
});
