# Scheduled publishing

A creator can send a post later instead of now. In Poster, and in the
cross-post sheet opened from Ideas or a take, the publish area has a
Post now / Schedule switch. Schedule shows a local date and time field,
three quick picks (tomorrow 9:00, tomorrow 18:00, the coming Saturday 10:00)
and the time zone the time is read in. The primary button names the exact time,
for example "Schedule 3 posts for Thu, Oct 29, 9:00 AM".

Each destination gets its own immutable saved request: the video, cover, copy
and the platform settings the creator reviewed. YouTube keeps its visibility,
audience and synthetic-media answers. Instagram publishes a Reel. TikTok uses
Direct Post with the reviewed audience, interaction and disclosure settings, or
sends a draft to the TikTok inbox when the creator picked that method.
Scheduling also moves the Library item's planning date to the post time, so the
Poster card shows when the video goes out.

## Calendar

Calendar shows scheduled posts on the month and week grids as chips with the
platform, time and title, tinted by state: yellow while waiting, cyan while
sending, green for a TikTok draft, red when the creator needs to act.
Published posts appear as the platform's own posted badge with views, and
cancelled ones disappear. A planned Library item whose posts are armed shows as
those posts, not as a second chip.

Clicking a chip opens its details with Change time and Cancel post. A waiting
post can be dragged to another day and keeps its time of day; a drop that lands
in the past is refused with a message. Failed posts and posts the platform
could not confirm are also listed above the grid with a Fix or Review action.
Hovering a future day shows a "+" that opens Poster already set to Schedule at
9:00 that day (or the next whole hour today). The "+" and the Schedule switch
only appear when the server has scheduling enabled.

On a phone the month cells are too narrow for text, so chips show only the
platform icon. Tapping one opens the same details. Drag to move is desktop only.

## How a post gets sent

Schedules live in `publishing_schedules`. The worker endpoint
`/api/internal/publishing` claims up to three due rows, sends each through the
same guarded publisher that "Post now" uses, settles the outcome, and returns
`nextDueAt`: the earliest scheduled time or sending recheck still in the queue,
or null when the queue is empty.

The endpoint is called by the publish clock, a Cloudflare Worker in
`workers/publish-clock`. It holds one Durable Object with one alarm. Yapper
calls the clock's `/wake` whenever a schedule is created, moved or retried
(`src/lib/publish/schedule-wake.ts`), which moves the alarm earlier if needed.
When the alarm fires, the clock calls the worker endpoint and sets the next
alarm from `nextDueAt`, never sooner than five seconds out. A cron runs the
clock every hour as well, so a lost wake delays a post by up to an hour instead
of dropping it. If a sweep fails, Cloudflare retries the alarm with backoff.

The database is only queried when something is due, about once an hour
otherwise. A per-minute poll would keep the Neon compute awake around the clock.

The endpoint accepts `Authorization: Bearer <PUBLISH_SCHEDULER_SECRET>` or
`Bearer <CRON_SECRET>`, so a Vercel cron can drive it instead on a plan that
allows per-minute crons.

## TikTok

A Direct Post schedule is checked twice against the creator's TikTok account:
when it is scheduled (audience still offered, interactions allowed, video
length within the account's limit) and again at send time, since the creator
can change their TikTok settings in between. The saved settings are pinned to
the account they were reviewed for.

TikTok processes a Direct Post after accepting it. When it reports the post as
still processing, the row stays in Sending and the worker asks again every 45
seconds with the same publish key, which checks status rather than posting
again. After an hour of processing it shows "Check the platform".

## Recovery and limits

- A post that never started sending and is more than a day late is not sent.
  It fails with "Choose a new time" instead of going out at an unexpected hour.
  Only a clock outage can make a post that late.
- Each worker run claims at most three due posts under a six-minute lease, which
  is longer than the route's five-minute limit. A replacement run reuses the
  original publish key, so an expired lease cannot post twice.
- The saved request records the external account it was reviewed for.
  Reconnecting a different account fails the schedule; the creator schedules
  again for the new account.
- Cancel and change time take a row lock and work only before sending starts.
  A retry moves to a new publish key only after a known failure. An unknown
  provider outcome shows "Check the platform" and is never resent
  automatically. Delayed completions are reconciled on later sweeps.
- A lost create response can be replayed with the same request key. A changed
  payload under an existing key is rejected.
- Covers stay protected until the scheduled time plus one day, including after
  a change of time. Deleting the source video makes its scheduled post fail
  with a clear message.
- One selection holds at most 20 destinations, one minute to 90 days ahead, and
  an account can hold at most 10 scheduled videos in storage. Calendar loads the
  latest 100 schedules, active ones first.

## Turning it on

1. Generate a secret (`openssl rand -hex 32`) and set it in both places.
   Never print or commit it.

   ```bash
   cd workers/publish-clock && npm install
   npx wrangler secret put PUBLISH_SCHEDULER_SECRET
   npx wrangler deploy
   ```

2. In Vercel production, set `PUBLISH_SCHEDULER_SECRET` to the same value,
   `PUBLISH_SCHEDULER_URL` to the deployed worker URL
   (`https://yapper-publish-clock.<account>.workers.dev`) and
   `STUDIO_SCHEDULER_ENABLED=1`, then redeploy. The flag is off by default;
   while off, creating, moving and retrying schedules is unavailable and the
   Schedule switch is hidden, but existing rows stay visible and cancellable.
3. Check the clock with
   `curl -H "Authorization: Bearer $SECRET" https://<worker>/status`. It returns
   the next alarm, or null when nothing is queued.
4. Rehearse with a controlled account: schedule a private YouTube upload a few
   minutes out, watch it go from Scheduled to Sending to posted in Calendar,
   confirm the visibility in YouTube Studio, then run the worker again and
   confirm no second post.

To use a Vercel per-minute cron instead (Pro plan), add
`{ "path": "/api/internal/publishing", "schedule": "* * * * *" }` to
`vercel.json` and skip the worker. Expect the database to stay awake.
