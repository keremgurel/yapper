import { Buffer } from "node:buffer";

// Fake auth signs every visitor in as one test user. It is for localhost only.
if (process.env.YAPPER_FAKE_AUTH) {
  throw new Error("YAPPER_FAKE_AUTH must never be set for a build");
}

if (process.env.VERCEL === "1") {
  const secret = process.env.RATE_LIMIT_SUBJECT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "RATE_LIMIT_SUBJECT_SECRET must contain at least 32 bytes on Vercel",
    );
  }
  if (process.env.RATE_LIMIT_TRUST_PROXY !== "vercel") {
    throw new Error('RATE_LIMIT_TRUST_PROXY must equal "vercel" on Vercel');
  }
  if (
    process.env.VERCEL_ENV === "production" &&
    !process.env.CRON_SECRET?.trim()
  ) {
    throw new Error(
      "CRON_SECRET is required in production so storage cleanup can run",
    );
  }
}
