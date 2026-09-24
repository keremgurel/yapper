import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALWAYS_ON_SKILL_SLUGS } from "@/lib/brain/context/always-on";
import { STARTER_SKILL_SLUGS } from "@/lib/brain/default-skills";

describe("write like a person migration", () => {
  const migration = readFileSync(
    "drizzle/0031_write_like_a_person.sql",
    "utf8",
  );

  it("adds the always-on starter everywhere", () => {
    expect(migration).toContain("'write-like-a-person'");
    expect(STARTER_SKILL_SLUGS[0]).toBe("write-like-a-person");
    expect(ALWAYS_ON_SKILL_SLUGS.has("write-like-a-person")).toBe(true);
  });

  it("never overwrites a catalog edit or a project's own copy", () => {
    expect(migration).toContain('ON CONFLICT ("slug") DO NOTHING');
    expect(migration).toContain(
      'ON CONFLICT ("project_id","catalog_slug") DO NOTHING',
    );
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b/i);
  });

  it("follows its own rules", () => {
    expect(migration).not.toMatch(/[—–]/);
  });

  it("is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(
      expect.objectContaining({ idx: 31, tag: "0031_write_like_a_person" }),
    );
  });
});
