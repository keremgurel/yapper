import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
import {
  deleteView,
  listViews,
  seedViewsIfEmpty,
  updateView,
} from "./library-views";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "creator" }, { id: "other" }]);
});
afterAll(async () => {
  await client.close();
});

it("concurrent first loads return one complete, ordered set of defaults", async () => {
  const [first, second] = await Promise.all([
    seedViewsIfEmpty("creator", "library"),
    seedViewsIfEmpty("creator", "library"),
  ]);
  expect(first.map((view) => view.id)).toEqual(second.map((view) => view.id));
  expect(
    (await listViews("creator", "library")).map((view) => view.name),
  ).toEqual(["All", "Not posted", "By status", "By pillar"]);
});

it("keeps saved edits and isolates both owners and surfaces", async () => {
  const [view] = await seedViewsIfEmpty("creator", "library");
  await updateView("creator", view.id, {
    name: "My shorts",
    groupBy: "format",
    filters: { formats: ["short-form"] },
  });
  expect(
    await updateView("other", view.id, { name: "Wrong owner" }),
  ).toBeNull();
  expect(await deleteView("other", view.id)).toBe(false);
  const [saved] = await seedViewsIfEmpty("creator", "library");
  expect(saved).toMatchObject({
    id: view.id,
    name: "My shorts",
    groupBy: "format",
    filters: { formats: ["short-form"] },
  });
  expect(await seedViewsIfEmpty("creator", "bank")).toHaveLength(2);
  expect(await seedViewsIfEmpty("other", "library")).toHaveLength(4);
  expect(await listViews("creator", "library")).toHaveLength(4);
});

it("recreates usable defaults after the last saved view is removed", async () => {
  const initial = await seedViewsIfEmpty("creator", "library");
  for (const view of initial) await deleteView("creator", view.id);
  expect(await listViews("creator", "library")).toEqual([]);
  const restored = await seedViewsIfEmpty("creator", "library");
  expect(restored).toHaveLength(4);
  expect(
    restored.some((view) => initial.some((old) => old.id === view.id)),
  ).toBe(false);
});
