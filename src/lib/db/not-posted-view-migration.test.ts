import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import * as schema from "./schema";

const client = new PGlite();
const db = drizzle(client, { schema });
const migration = readFileSync(
  "drizzle/0042_not_posted_includes_captured.sql",
  "utf8",
);

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values({ id: "creator" });
});
afterAll(async () => {
  await client.close();
});

async function view(
  name: string,
  status: string[],
  stage: "bank" | "library" = "library",
) {
  const [row] = await db
    .insert(schema.libraryViews)
    .values({ userId: "creator", stage, name, filters: { status } })
    .returning();
  return row.id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select()
    .from(schema.libraryViews)
    .where(eq(schema.libraryViews.id, id));
  return row.filters.status;
}

it("adds captured to the Not posted view that 0023 rewrote", async () => {
  const seeded = await view("Not posted", ["drafting", "ready", "ready"]);
  const renamed = await view("Still to shoot", ["drafting", "ready", "ready"]);
  const resaved = await view("Not posted", ["drafting", "ready"]);
  await client.exec(migration);
  for (const id of [seeded, renamed, resaved]) {
    expect(await statusOf(id)).toEqual(["captured", "drafting", "ready"]);
  }
});

it("leaves views the creator chose on purpose alone", async () => {
  const readyOnly = await view("Ready to shoot", ["ready"]);
  const withCaptured = await view("Not posted", ["captured", "drafting"]);
  const posted = await view("Not posted", ["drafting", "posted"]);
  const bank = await view("Not posted", ["drafting", "ready", "ready"], "bank");
  await client.exec(migration);
  expect(await statusOf(readyOnly)).toEqual(["ready"]);
  expect(await statusOf(withCaptured)).toEqual(["captured", "drafting"]);
  expect(await statusOf(posted)).toEqual(["drafting", "posted"]);
  expect(await statusOf(bank)).toEqual(["drafting", "ready", "ready"]);
});

it("is registered in the journal", () => {
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  expect(journal.entries).toContainEqual(
    expect.objectContaining({
      idx: 42,
      tag: "0042_not_posted_includes_captured",
    }),
  );
});
