import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazily created so importing the db module never opens a connection at build
// time. Uses the pooled Neon endpoint (pgbouncer) — good for serverless.
let db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
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
