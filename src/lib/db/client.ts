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
    db = drizzle(new Pool({ connectionString, max: 5 }), { schema });
  }
  return db;
}
