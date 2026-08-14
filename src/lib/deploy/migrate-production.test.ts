import { describe, expect, it, vi } from "vitest";

import {
  migrateProduction,
  productionDatabaseUrl,
  shouldRunProductionMigrations,
} from "../../../scripts/migrate-production.mjs";

describe("production migration deployment guard", () => {
  it("runs only in a Vercel production build", () => {
    expect(
      shouldRunProductionMigrations({ VERCEL: "1", VERCEL_ENV: "production" }),
    ).toBe(true);
    expect(
      shouldRunProductionMigrations({ VERCEL: "1", VERCEL_ENV: "preview" }),
    ).toBe(false);
    expect(shouldRunProductionMigrations({ VERCEL_ENV: "production" })).toBe(
      false,
    );
  });

  it("requires the direct database connection for production", () => {
    expect(() => productionDatabaseUrl({})).toThrow(
      "DATABASE_URL_UNPOOLED is required",
    );
    expect(() =>
      productionDatabaseUrl({ DATABASE_URL_UNPOOLED: "  " }),
    ).toThrow("DATABASE_URL_UNPOOLED is required");
  });

  it("does no database work for local, CI, or preview builds", async () => {
    const migrate = vi.fn();
    const log = vi.fn();

    await expect(
      migrateProduction({ environment: {}, migrate, log }),
    ).resolves.toEqual({ applied: false });
    expect(migrate).not.toHaveBeenCalled();
  });

  it("passes the direct URL to the production migration runner", async () => {
    const migrate = vi.fn().mockResolvedValue(undefined);

    await expect(
      migrateProduction({
        environment: {
          VERCEL: "1",
          VERCEL_ENV: "production",
          DATABASE_URL_UNPOOLED: " postgres://direct/database ",
        },
        cwd: "/repo",
        migrate,
        log: vi.fn(),
      }),
    ).resolves.toEqual({ applied: true });

    expect(migrate).toHaveBeenCalledOnce();
    expect(migrate).toHaveBeenCalledWith({
      databaseUrl: "postgres://direct/database",
      cwd: "/repo",
      log: expect.any(Function),
    });
  });
});
