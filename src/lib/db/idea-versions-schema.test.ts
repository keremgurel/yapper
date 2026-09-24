import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("idea versions migration", () => {
  const migration = readFileSync("drizzle/0029_idea_versions.sql", "utf8");

  it("only adds: no drops, renames or rewrites of existing data", () => {
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bRENAME\b/i);
    expect(migration).not.toMatch(/(^|;|breakpoint)\s*UPDATE\s/im);
  });

  it("gives existing ideas a short-form lead and projects a short-form default", () => {
    expect(migration).toContain(
      `ALTER TABLE "content_items" ADD COLUMN "lead_format" text DEFAULT 'short' NOT NULL`,
    );
    expect(migration).toContain(
      `ALTER TABLE "projects" ADD COLUMN "default_format" text DEFAULT 'short' NOT NULL`,
    );
  });

  it("keeps one version per idea and format, removed with the idea", () => {
    expect(migration).toContain('CREATE TABLE "content_versions"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "content_versions_item_format_unique" ON "content_versions" USING btree ("content_item_id","format")',
    );
    expect(migration).toContain("ON DELETE cascade");
  });

  it("is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(
      expect.objectContaining({ idx: 29, tag: "0029_idea_versions" }),
    );
  });
});
