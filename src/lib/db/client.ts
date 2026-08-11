import type { ExtractTablesWithRelations } from "drizzle-orm";
import {
  drizzle,
  type NodePgDatabase,
  type NodePgQueryResultHKT,
} from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { warnOnCrossInstanceDatabase } from "./cross-instance-guard";
import * as schema from "./schema";

/** A live transaction handle shared by helpers that must commit together. */
export type DbTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// Lazily created so importing the db module never opens a connection at build
// time. Uses the pooled Neon endpoint (pgbouncer) — good for serverless.
let db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    // Once, on the first connection of the process.
    warnOnCrossInstanceDatabase();
    const pool = new Pool({
      connectionString,
      max: 10,
      // Fail fast instead of hanging forever if the pool is saturated.
      connectionTimeoutMillis: 10_000,
    });
    // Idle clients can drop (Neon/pgbouncer closes idle conns); without a
    // listener that 'error' is thrown and can crash the serverless instance.
    pool.on("error", (err) => {
      console.error("pg pool idle client error:", err);
    });
    db = drizzle(pool, { schema });
  }
  return db;
}
