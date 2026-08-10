/**
 * Warns when a development Clerk instance is pointed at a shared database.
 *
 * Clerk's development and production instances are separate directories of
 * people: the same email signed into each gets two different `user_...` ids.
 * Every table here is keyed by that id, so running localhost (a `sk_test` key)
 * against the production database quietly forks an account in two. It is
 * invisible until something is only true of one of them, which is how one
 * account ended up with the subscription and the other with the desktop app
 * signed into it.
 *
 * A warning rather than a refusal: pointing local dev at real data is sometimes
 * exactly what someone means to do, and a hard failure would break that on
 * purpose. Set `ALLOW_DEV_CLERK_ON_SHARED_DB=1` to silence it.
 */
export function warnOnCrossInstanceDatabase(
  env: Partial<Record<string, string>> = process.env,
  warn: (message: string) => void = console.warn,
): boolean {
  if (env.ALLOW_DEV_CLERK_ON_SHARED_DB === "1") return false;
  const secret = env.CLERK_SECRET_KEY ?? "";
  if (!secret.startsWith("sk_test")) return false;

  const url = env.DATABASE_URL ?? "";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  // A database on this machine cannot be the shared one.
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return false;
  }

  warn(
    `[db] Development Clerk keys are pointed at a remote database (${host}). ` +
      "Signing in here mints new Clerk user ids and writes them alongside the " +
      "production ones, which forks the same person into two accounts. Use a " +
      "database branch for local work, or set ALLOW_DEV_CLERK_ON_SHARED_DB=1 " +
      "if this is deliberate.",
  );
  return true;
}
