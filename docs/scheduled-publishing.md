# Scheduled publishing

Studio's Calendar dates remain planning dates. Sending is armed only through
**Cross-post → Schedule for later**, after choosing the video, copy, cover,
destination accounts, and a local time. Each destination receives its own
immutable saved request. YouTube requests the chosen privacy setting (public
in the current sheet); Instagram publishes a Reel; TikTok receives a draft
that the creator finishes in TikTok. Platform processing and worker load can
delay completion beyond the selected time.

## Deployment

1. Apply the committed Drizzle migrations, including
   `0021_studio_publishing_schedules.sql`, to the intended deployment database.
   The isolated database tests apply every migration; they do not use
   `DATABASE_URL` or modify a deployed database.
2. Configure `CRON_SECRET` and a worker with access to the same database,
   encrypted OAuth connections, R2 storage, and provider configuration as
   Studio. The existing deployment validation remains required.
3. The worker needs a scheduler. The project is on the Vercel Hobby plan,
   which permits daily cron schedules only (see the official
   [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)), so the
   per-minute cron is not in `vercel.json`: a deploy carrying it fails
   validation. After upgrading to Pro, add it back next to the storage cleanup
   entry:

   ```json
   { "path": "/api/internal/publishing", "schedule": "* * * * *" }
   ```

   Until then an external scheduler can call the protected endpoint with
   `Authorization: Bearer <CRON_SECRET>` at the same cadence.

4. Set `STUDIO_SCHEDULER_ENABLED=1` only when the worker is configured. The flag
   is off by default. Creating/rescheduling/retrying posts is unavailable while
   off; existing rows stay visible and can be cancelled. An already claimed
   operation can finish after the flag is turned off.
5. Verify in staging using controlled accounts: create, reload, reschedule,
   cancel, run a due operation, inspect its actual provider result, and run the
   worker again to confirm no second post. Exercise two worker processes and
   an expired lease. The in-memory PostgreSQL tests validate SQL and durable
   outcomes but use one connection; they do not prove production contention.

No deployed migrations, scheduler flags, or live provider posts were changed by
implementation tests. The repository's `npm run build` applies production
migrations; it is not a safe substitute for an isolated validation build.

## Recovery and limits

- Each worker claims up to three due destinations. A six-minute lease exceeds
  the route's five-minute execution budget. A replacement worker reuses the
  original per-platform publish key. Expired work is not silently reposted.
- The saved request includes the expected external account ID. Reconnecting a
  different account fails the schedule and requires a fresh reviewed request.
  Token refresh cannot overwrite a connection that changed during refresh.
- Cancel/reschedule takes a row lock and is permitted before sending starts.
  A retry advances the publish key only after a durable known failure. Unknown
  provider outcomes show **Check the platform**, with no automatic resend.
- Delayed durable completions are reconciled on subsequent worker sweeps. A
  provider success whose identifier never reached durable storage can still
  require manual provider inspection; the system does not claim that case is
  automatically resolved.
- A lost create response can be retried with the same request key, including
  after its original due time. Changed payloads using an existing key are
  rejected. A source selected through two aliases cannot create duplicate
  destinations in one selection.
- Covers remain protected through the scheduled time plus one day, including
  reschedules. Deleting a source video can make its scheduled post fail; the
  normal ownership and file-readiness checks still apply when sending starts.
- The creation limit is 20 destinations per reviewed selection, one minute to
  90 days ahead. Calendar currently shows the latest 100 entries, prioritizing
  pending and actionable work. Large-account history pagination remains an
  explicit follow-up before scaling beyond this bound.
- Worker response counts (`claimed`, `settled`, `deferred`, `reconciled`) are
  operational signals. Deferred rows recover after lease expiry. Monitor cron
  failures and queue age in the deployment's logs; this change does not add an
  external monitoring service.
