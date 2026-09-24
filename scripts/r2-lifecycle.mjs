// Expire the bucket's scratch prefixes, whatever the app did or did not do.
//
// Transcription audio lives under asr/ for one request. The app deletes it
// when the transcriber is done or refuses; this rule is the backstop for a
// request that died halfway. Also aborts multipart uploads left incomplete.
//
// The app's own R2 token is object-scoped and is refused here on purpose.
// Run with an admin token (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY for a key
// with bucket settings access), or add the same two rules in the Cloudflare
// dashboard: R2 > yapper-media > Settings > Object lifecycle rules.
//
// Usage: node --env-file=.env.local scripts/r2-lifecycle.mjs [--apply]
// Without --apply it prints the rules it would set and changes nothing.
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const bucket = process.env.R2_BUCKET;
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const OURS = [
  {
    ID: "expire-transcription-scratch",
    Status: "Enabled",
    Filter: { Prefix: "asr/" },
    Expiration: { Days: 1 },
  },
  {
    ID: "abort-incomplete-multipart",
    Status: "Enabled",
    Filter: { Prefix: "" },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  },
];

let existing = [];
try {
  const current = await client.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
  );
  existing = current.Rules ?? [];
} catch (error) {
  if (error?.name !== "NoSuchLifecycleConfiguration") throw error;
}
const ids = new Set(OURS.map((rule) => rule.ID));
const rules = [...existing.filter((rule) => !ids.has(rule.ID)), ...OURS];
console.log(`Bucket ${bucket}: ${existing.length} existing rule(s)`);
console.log(JSON.stringify(rules, null, 2));
if (!process.argv.includes("--apply")) {
  console.log("Dry run. Re-run with --apply to set these rules.");
  process.exit(0);
}
await client.send(
  new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: { Rules: rules },
  }),
);
console.log("Lifecycle rules applied.");
