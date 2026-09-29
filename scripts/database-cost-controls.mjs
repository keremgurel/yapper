// Bound runaway queries on this application's database and role only.
// PgBouncer can ignore startup timeout options; set durable Postgres defaults
// through the direct endpoint, then verify new direct AND pooled connections.
// Existing pooled backends adopt the defaults when Neon recycles them.
// Usage: node --env-file=.env.local scripts/database-cost-controls.mjs [--apply]
import { Client } from "pg";

const pooled = new URL(process.env.DATABASE_URL);
const direct = new URL(process.env.DATABASE_URL_UNPOOLED);
if (
  pooled.hostname.replace("-pooler.", ".") !== direct.hostname ||
  pooled.pathname !== direct.pathname ||
  pooled.username !== direct.username
) {
  throw new Error(
    "Pooled and direct URLs must target the same database and role",
  );
}

const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const inspect = `SELECT current_user AS role, current_database() AS database,
  current_setting('statement_timeout') AS statement_timeout,
  current_setting('idle_in_transaction_session_timeout') AS idle_transaction_timeout`;
const connection = (connectionString) =>
  new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    application_name: "yapper-cost-controls",
  });
const client = connection(direct.toString());
try {
  await client.connect();
  const before = (await client.query(inspect)).rows[0];
  console.log("Current direct settings:", before);
  if (process.argv.includes("--apply")) {
    const settings = (
      await client.query(`SELECT name, setting::bigint AS milliseconds
      FROM pg_settings WHERE name IN ('statement_timeout', 'idle_in_transaction_session_timeout')`)
    ).rows;
    for (const { name, milliseconds } of settings) {
      // Preserve any already stricter nonzero deadline.
      const limit =
        Number(milliseconds) > 0
          ? Math.min(Number(milliseconds), 30_000)
          : 30_000;
      await client.query(
        `ALTER ROLE ${identifier(before.role)} IN DATABASE ${identifier(before.database)} SET ${identifier(name)} = '${limit}ms'`,
      );
    }
    console.log(
      "Applied at most 30-second deadlines to this database/role only.",
    );
  } else {
    console.log("Dry run. Use --apply to set database/role defaults.");
  }
} finally {
  await client.end();
}

for (const [label, url] of [
  ["Direct", direct],
  ["Pooled", pooled],
]) {
  const check = connection(url.toString());
  try {
    await check.connect();
    console.log(
      `${label} new connection:`,
      (await check.query(inspect)).rows[0],
    );
  } finally {
    await check.end();
  }
}
