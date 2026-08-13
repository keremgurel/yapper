# Rate limiting operations

Yapper's distributed limiter stores only HMAC subject digests and token-bucket
state in PostgreSQL. It never persists or logs raw user ids, email addresses,
or client IP addresses. IPv6 clients are grouped by `/64` before hashing.

Every Vercel environment requires:

- `RATE_LIMIT_SUBJECT_SECRET`: a random secret of at least 32 bytes. Keep it
  stable; rotation resets subject continuity and should be coordinated.
- `RATE_LIMIT_TRUST_PROXY=vercel`: explicitly permits the app to use Vercel's
  overwritten forwarding headers. Other values intentionally place clients in
  the bounded `unknown` bucket.
- `CRON_SECRET`: required by the existing maintenance cron, which also removes
  expired limiter buckets in bounded batches.

`npm run build` runs `scripts/validate-deploy-env.mjs` and fails a Vercel build
when either rate-limit variable is missing or invalid. Local and generic CI
builds are not behind Vercel and therefore do not require proxy trust.

Structured `[rate-limit]` logs contain only `outcome`, fixed policy `scope`,
actor category, and the `unknownIp` boolean. Use them to monitor allowed,
denied, unavailable, and unknown-IP rates; never add subjects or caller input.
