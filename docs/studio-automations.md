# Instagram repurposing automation

The Automations screen saves one rule per creator. Its setup and enabled state
are persisted on the server; changing a toggle only edits the form until Save
succeeds. Enabling requires the reviewed Instagram, YouTube and/or TikTok
accounts to still match, an available worker, and the existing import entitlement.
YouTube is requested as public; TikTok receives a draft for the creator to finish.

The worker detects only Instagram videos posted from the rule's latest enable
time. It does not backfill posts from before enabling or from a paused interval.
The scanner fetches the newest page and advances a stored cursor through further
pages. It does not assume every post fits on the first page or rely on timestamp
ordering. Instagram's API uses cursor pagination; see Meta's official
[API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

Detected videos receive a unique durable run per rule/source post. The run
captures the caption, formatting settings, and destination accounts. Import uses
the same streaming, quota, entitlement, source-file resolution, and cleanup path
as manual Instagram imports. Background work consumes the same user's spending
budgets, without inventing a client IP. Missing files and failed imports appear
in activity with a retry action. Destination publication uses the shared durable
queue and its existing provider idempotency boundary.

Disabling locks the rule, cancels waiting/importing runs and scheduled/failed
deliveries, and prevents a delayed import from enqueuing new posts. A platform
send already claimed can finish. Settings changes while enabled apply to future
discoveries; prepared deliveries keep their captured copy and destinations.
Repeated scans, import retries, and expired leases reuse durable identities.

## Deployment and verification

- Apply migrations through `0022_studio_automations.sql`. Isolated PostgreSQL
  tests execute all migrations without using the deployment's database.
- Configure the publishing worker described in `scheduled-publishing.md` first.
  Set `STUDIO_SCHEDULER_ENABLED=1`, `CRON_SECRET`, and then
  `STUDIO_AUTOMATIONS_ENABLED=1` when the automation worker is ready.
- `vercel.json` checks `/api/internal/automations` every five minutes with the
  protected cron secret. Each invocation claims up to three rules and three
  imports; a six-minute lease allows interrupted work to recover. A compatible
  hosting plan or external scheduler is required for this cadence.
- Turning off the automation flag pauses discovery/import work. Deliveries
  already in the publishing queue may continue while the publishing flag is
  enabled. Pause the user's rule to cancel its waiting deliveries. The screen
  explains this distinction.
- Verify configured account listing, source-file availability, a newly created
  controlled Instagram video, actual destination results, two simultaneous
  worker processes, and account reconnect/disable races in staging before
  enabling a production worker. Never use a user's historical feed as a test
  backfill. Neither worker flag was enabled during implementation.
- Imported source files consume the user's storage under the existing accounting
  rules. Formatting uses the original caption, deterministic hashtag removal,
  and a title/description split; it does not make a hidden AI generation call.
- Run history currently shows the latest 50 detected videos and their destination
  outcomes. History pagination and higher worker throughput are explicit scaling
  follow-ups, rather than silently claiming unlimited capacity.
