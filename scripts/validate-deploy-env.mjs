import { Buffer } from "node:buffer";

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
}
