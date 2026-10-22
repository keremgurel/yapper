import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
import { deleteConnection } from "./publish";
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
  await db.insert(schema.platformConnections).values([
    {
      userId: "owner",
      platform: "youtube",
      accessTokenEnc: "access",
      refreshTokenEnc: "refresh",
    },
    { userId: "other", platform: "youtube", accessTokenEnc: "other-token" },
    { userId: "owner", platform: "instagram", accessTokenEnc: "ig-token" },
  ]);
});
afterAll(() => client.close());
it("keeps the retry credential if revocation fails", async () => {
  await expect(
    deleteConnection("owner", "youtube", async () => {
      throw new Error("provider-unavailable");
    }),
  ).rejects.toThrow("provider-unavailable");
  const rows = await db.select().from(schema.platformConnections);
  expect(rows).toHaveLength(3);
  expect(
    rows.find((r) => r.userId === "owner" && r.platform === "youtube")
      ?.refreshTokenEnc,
  ).toBe("refresh");
});
it("revokes before deleting only the caller's selected connection", async () => {
  const revoke = vi.fn(async (row) => {
    expect(row.refreshTokenEnc).toBe("refresh");
  });
  expect(await deleteConnection("owner", "youtube", revoke)).toBe(true);
  expect(revoke).toHaveBeenCalledOnce();
  const rows = await db.select().from(schema.platformConnections);
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => `${r.userId}:${r.platform}`).sort()).toEqual([
    "other:youtube",
    "owner:instagram",
  ]);
  expect(await deleteConnection("owner", "youtube", revoke)).toBe(false);
  expect(revoke).toHaveBeenCalledOnce();
});
