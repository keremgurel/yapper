# Production database migrations

Vercel production builds apply pending Drizzle migrations before `next build`.
The migration step:

- runs only when `VERCEL=1` and `VERCEL_ENV=production`;
- requires `DATABASE_URL_UNPOOLED`, so schema changes never use PgBouncer;
- serializes concurrent builds with a PostgreSQL advisory lock;
- verifies that the production migration ledger contains every local migration;
- fails the build on any migration or verification error, leaving the previous
  production deployment active.

Preview, CI, and local builds skip the production migration step. PostgreSQL CI
still applies migrations to its isolated test database independently.

Migrations deployed through this path must remain backward-compatible with the
currently serving application. Use additive tables, columns, and indexes first;
remove old schema only in a later deployment after all serving code has stopped
using it.
