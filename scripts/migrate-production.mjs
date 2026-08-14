import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCK_NAMESPACE = 1_498_375_504;
const LOCK_OPERATION = 1_163_024_711;

export function shouldRunProductionMigrations(environment) {
  return environment.VERCEL === "1" && environment.VERCEL_ENV === "production";
}

export function productionDatabaseUrl(environment) {
  const url = environment.DATABASE_URL_UNPOOLED?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED is required for Vercel production migrations",
    );
  }
  return url;
}

export async function migrateProduction(options = {}) {
  const environment = options.environment ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const migrate = options.migrate ?? runLockedMigrations;
  const log = options.log ?? console.log;
  if (!shouldRunProductionMigrations(environment)) {
    log("Skipping production migrations outside a Vercel production build");
    return { applied: false };
  }

  const databaseUrl = productionDatabaseUrl(environment);
  await migrate({ databaseUrl, cwd, log });
  return { applied: true };
}

async function runLockedMigrations({ databaseUrl, cwd, log }) {
  const [{ Client }, { drizzle }, { migrate }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
    import("drizzle-orm/node-postgres/migrator"),
  ]);

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    query_timeout: 120_000,
    application_name: "yapper-vercel-migrate",
  });
  let locked = false;

  try {
    await client.connect();
    await client.query("select pg_advisory_lock($1::integer, $2::integer)", [
      LOCK_NAMESPACE,
      LOCK_OPERATION,
    ]);
    locked = true;

    await migrate(drizzle(client), {
      migrationsFolder: path.join(cwd, "drizzle"),
    });

    const journal = JSON.parse(
      await readFile(path.join(cwd, "drizzle/meta/_journal.json"), "utf8"),
    );
    const expected = journal.entries.length;
    const result = await client.query(
      "select count(*)::integer as count from drizzle.__drizzle_migrations",
    );
    const actual = result.rows[0]?.count;
    if (!Number.isInteger(actual) || actual < expected) {
      throw new Error(
        `Production migration verification failed: expected at least ${expected}, found ${String(actual)}`,
      );
    }

    log(`Production schema is current (${actual} migrations recorded)`);
  } finally {
    if (locked) {
      try {
        await client.query(
          "select pg_advisory_unlock($1::integer, $2::integer)",
          [LOCK_NAMESPACE, LOCK_OPERATION],
        );
      } catch {
        // Closing the session below also releases the advisory lock. Preserve
        // the migration or verification error instead of masking it here.
      }
    }
    await client.end().catch(() => undefined);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  await migrateProduction();
}
