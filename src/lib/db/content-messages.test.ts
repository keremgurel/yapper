import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));

const { appendContentMessages, clearContentMessages, listContentMessages } =
  await import("./content-messages");
const { createContentItem } = await import("./content");

describe("content messages", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  }, 30_000);
  beforeEach(async () => {
    await client.exec("TRUNCATE users CASCADE");
    await db
      .insert(schema.users)
      .values([{ id: "user_test" }, { id: "user_other" }]);
  });

  it("keeps a thread in order and scoped to the owner", async () => {
    const item = await createContentItem("user_test", { title: "Idea" });
    await appendContentMessages("user_test", item.id, [
      { role: "creator", text: "Write the script" },
      {
        role: "chirpy",
        text: "Rewrote Script.",
        actions: [{ type: "append" }],
      },
    ]);
    const mine = await listContentMessages("user_test", item.id);
    expect(mine.map((m) => m.role)).toEqual(["creator", "chirpy"]);
    expect(mine[1].actions).toEqual([{ type: "append" }]);
    expect(await listContentMessages("user_other", item.id)).toEqual([]);
    await expect(
      appendContentMessages("user_other", item.id, [
        { role: "creator", text: "mine now" },
      ]),
    ).rejects.toThrow("content_not_owned");
  });

  it("clears only the owner's thread and cascades with the item", async () => {
    const item = await createContentItem("user_test", { title: "Idea" });
    await appendContentMessages("user_test", item.id, [
      { role: "creator", text: "hello" },
    ]);
    await clearContentMessages("user_other", item.id);
    expect(await listContentMessages("user_test", item.id)).toHaveLength(1);
    await clearContentMessages("user_test", item.id);
    expect(await listContentMessages("user_test", item.id)).toHaveLength(0);
  });
});
