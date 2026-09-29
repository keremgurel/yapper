# Launch cost controls

Implemented September 29, 2026. This document supersedes the proposals and old
prices in `unit-economics-and-pricing.md` and `public-billing-design.md`.

## What the customer buys

Membership prices stay $7.99/week, $24.99/month, or $199.99/year. They buy the
same features with different payment schedules. Paid invoices add 100, 500 or
6,000 credits respectively. Annual credits arrive after annual payment, not in
a free trial. The first card-backed trial adds 30 credits once per account;
opening another checkout cannot earn another grant. The separate welcome grant
still covers one practice feedback. Paid credits and existing balances are not
removed by this change. There are no automatic top-ups or metered overage bills.
Unreviewed subscription promotion codes are disabled for new checkouts.

Storage is a **5 GiB concurrent temporary workspace on every membership**. It
does not reset or accumulate. Free users cannot upload cloud videos. Poster
keeps one current video; scheduled posts and publishing retries protect the
files they need. Published files become eligible after 24 hours, with physical
deletion at the next successful cleanup. Lapsed account cleanup keeps its
existing 30-day grace. This is not a video archive. Capacity rejects additional
uploads; it never automatically upgrades a subscription or deletes protected
scheduled work. Existing over-capacity accounts would retain their files and
need to free space before uploading more.

## Pricing the expensive actions

| Action                              |                                 Credits |
| ----------------------------------- | --------------------------------------: |
| Chirpy action planning              |                                       6 |
| Brain setup                         |                                       8 |
| Training feedback                   |                                       3 |
| Transcription                       | 4 per started 3 minutes; max 60 minutes |
| Transcript cleanup                  |                                       8 |
| Media placement                     |                                       4 |
| Reference analysis / idea expansion |                                       8 |
| Creator feed analysis               |                                      20 |
| Thumbnail generation                |                                      12 |
| Overlay planning                    |                                      20 |
| Overlay design or revision          |                            60 per scene |
| Generated overlay image             |                                  8 each |
| Overlay retiming                    |                                      20 |

Duration for editor transcription is read from the owned media container before
billing, rather than trusting the client's duration header. Chunk overlap and
recovery totals are bounded. Paid overlay work earns at most three rendered
checks per unit for 24 hours. Each check is atomically claimed, including failed
attempts; an unrelated signed-in account cannot run free Opus reviews forever.
Refunded units void their unclaimed checks. Design QA remains included; it does
not silently add another customer charge. Retry-heavy workflows can still have
poor margins, which is why the company-wide cutoff below is also required.

At the lowest plan revenue per credit ($199.99 / 6,000 = $0.03333 gross), a
12-credit thumbnail brings in about $0.40 against Google's published $0.101
2K image output price, before input costs, payment fees, tax effects and other
operating costs. A 60-credit overlay brings in about $2 gross to cover its
multiple reasoning and QA calls. These are pricing cushions, not a guaranteed
margin on every retry-heavy request. Keep measured provider invoices in the
operating forecast; do not assume discounted model credits will always exist.

## Company-wide provider cutoff

Every paid text, image, video-analysis, transcription, scraper and Reader call
using the shared outbound boundary reserves a conservative safety allowance
before network work. This applies to retries, internal QA and background work.
Database transactions serialize the fixed UTC day/month counters across all
serverless instances. If either counter is exhausted or unavailable, no new
paid request starts. Failed attempts retain their reservation even when the
customer gets a credit refund. Unpaid HTTP metadata/storage reads do not consume
this allowance.

Defaults are **$25/day and $250/calendar month of reserved allowances**, set by
`PROVIDER_DAILY_BUDGET_USD` and `PROVIDER_MONTHLY_BUDGET_USD`. Either set to `0`
stops paid AI. Invalid settings fail closed. These conservative launch defaults
may stop legitimate work before an actual bill reaches those amounts. Increase
them deliberately against collected revenue and measured margins; they do not
automatically grow with signups or subscription count. Existing per-user and IP
request limits remain in place. Apify also receives a 90-second server-side run
timeout and a $0.50 maximum charge for each actor run.

The counters are **not settled spend or provider-enforced dollar caps**. Text
allowances use input bytes, a per-image token allowance, and bounded maximum
output tokens. ASR and Gemini calls currently reserve $1 per attempt; Apify
$0.50; Reader $0.05. Model price changes, unusual media and provider billing
semantics can differ. Reservations cover this application's outbound code, not
other applications sharing a provider key. Query `provider_spend_windows` to
see admitted attempts and reservations; do not book those values as expenses.

## Storage, database and analytics backstops

The daily cleanup also reconciles physical R2 inventory with application
references. It examines at most 1,000 keys within an eight-second budget and
persists its position, rather than repeatedly inspecting only the first page.
Untracked recognized media and transcription scratch files must be at least
48 hours old. They receive another 24-hour quarantine before the normal leased
worker can delete them. Unknown key formats, registered uploads, saved content,
logos, pending schedules and unfinished publishing jobs are preserved. The
worker rechecks schedules and their thumbnails immediately before deletion.
The database cursor makes this a repeated full-bucket scan, not a one-off purge;
at larger bucket sizes the scan can take multiple daily runs.

Partial cleanup or inventory failures return HTTP 503 for monitoring. Production
builds refuse a missing `CRON_SECRET`, because a scheduled request without it
would only receive 401. The separate bucket-level scratch expiry and multipart
abort rules remain useful even if the app or database is unavailable; install
them with `scripts/r2-lifecycle.mjs --apply` using bucket-settings access.

Analytics sends directly to PostHog instead of using paid hosting bandwidth as
a proxy. Explicit product events and exception tracking remain enabled. Session
replay, heatmaps, automatic click capture, page-leave events, performance events,
unused feature-flag evaluation and surveys are disabled. The app owns page-view
reporting, removing the duplicate initial page view. Vendor billing limits are
still required: lowering event volume is not a hard spending cap.

`scripts/database-cost-controls.mjs` inspects both connection paths. With
`--apply`, it sets at most 30-second statement and idle-transaction deadlines
for the configured role **in the configured database only**, preserving stricter
existing limits. This was applied and verified on direct production connections
on September 29. Existing pooled backends can retain their old defaults until
Neon recycles them; verify the script's pooled result before treating rollout
as complete. PgBouncer ignored startup timeout options in the live check, so
those ineffective client options were not shipped. Production migrations use
their own finite 120-second deadlines.

## Account-level verification

| Cost                          | Application control                                                                                                                       | External control still needed                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AI / transcription / scraping | Paid credits, rate limits, global admission cutoff, bounded attempts                                                                      | Separate Yapper provider keys; provider budgets/alerts; disable automatic balance refills unless deliberately budgeted |
| R2                            | 5 GiB cap, pending-upload reservations/expiry, one current video, retained-reference checks, inventory reconciliation and deletion worker | Account usage alerts, bucket lifecycle settings and operation monitoring                                               |
| Hosting / video transfer      | Direct uploads, finite request bodies/deadlines, publishing quotas                                                                        | Vercel spend management and traffic protection; watch media proxy bandwidth                                            |
| PostgreSQL                    | Persistent limits, bounded API lists, pooled connections                                                                                  | Neon compute/autoscaling ceiling and storage alerts                                                                    |
| Auth, email, analytics        | Existing app rate limits; no new automatic purchase path                                                                                  | Vendor plan limits, event retention and spend alerts                                                                   |
| Payments                      | No unpaid full-plan grant; idempotent paid invoices                                                                                       | Include processing fees, refunds, chargebacks and tax handling in margin forecasts                                     |

The authorized Apify account's API returned an existing **$5 monthly usage
limit** and seven-day retention on September 29; that stricter limit was kept.
R2 inventory and incomplete-upload listing work with the application key, but
bucket lifecycle settings return AccessDenied. Deepgram project discovery works,
but billing access is denied to the application key.

Other vendor billing controls remain unverified pending access to the Yapper
owner accounts. Do not change limits on another product's signed-in account.
Vercel's automatic spending pause is team-wide, so it must not inadvertently
pause other products. Gemini supports a project spending cap, but its billing
delay can permit overages. R2 has no hard bucket-size quota. These differences
mean a budget alert is not interchangeable with a hard cap. The application
cutoff does not cap infrastructure invoices, nor does this deployment claim
that every operating bill has a hard ceiling.

## Verified pricing references

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/): standard
  storage $0.015 per GB-month, plus operations. A full 5 GiB workspace is about
  $0.081/month for stored bytes alone; 1,000 full workspaces about $81/month.
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing): 2K Flash
  image output $0.101; model input and optional services are additional.
- [Deepgram pricing](https://deepgram.com/pricing): prerecorded Nova-3 monolingual
  $0.0043/minute, with keyterm prompting additional.
- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini):
  $0.75/M input tokens and $4.50/M output tokens.
- [Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7): published
  $5/M input and $25/M output; actual routed-provider billing can differ.
- [Vercel spend management](https://vercel.com/docs/spend-management): team-wide
  overage monitoring and optional project pausing.
- [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/): project spend
  caps and their enforcement delay.
- [Apify usage limits](https://docs.apify.com/api/v2/users-me-limits-get): account
  limit and current usage inspection.
