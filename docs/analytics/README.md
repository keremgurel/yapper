# Yapper operating overview

[Open the dashboard](https://us.posthog.com/project/383795/dashboard/2212591).
Project **383795**, UTC. CELPIP is a different project and is never written by
these scripts. The previous Yapper dashboards are preserved.

## What it answers

The overview follows CELPIP's operating layout: one daily pulse, six headline
counts, then acquisition, activation, Studio usage, Mac adoption, retention,
payments, reliability and coverage. It uses PostHog's own typography, controls,
colors and responsive twelve-column grid. Chart descriptions explain the
measurement and remain available in the insight. No new public admin page or
analytics read credentials are exposed by the website.

- Visitors, sources, landing/pages, countries and devices.
- Verified new accounts, seven-day activation and mature weekly return cohorts.
- Visible Studio screens, successful actions, recording and publishing.
- Mac first observations, foreground activity, versions, builds, OS and CPU.
- Export starts, successful renders, cancellation and failure.
- Cumulative GitHub download transfers by asset and release.
- Verified live Stripe charges, renewals, credit packs and trials.
- API failures by status, native handled errors, browser exceptions and freshness.

## Definitions and coverage

**Signups** are verified Clerk `user.created` deliveries, timestamped at Clerk's
creation time. `user.updated`, returning sign-ins, and database provisioning do
not count. Repeated deliveries carry `clerk-signup:<user ID>` as `$insert_id`;
queries additionally count unique account IDs. Authoritative Clerk/Stripe events
use immediate ingestion; failed ingestion returns a webhook error for provider
retry. Credit grants and account provisioning retain their existing idempotency. The local `.env.local` does not
contain a live Clerk secret, so historical accounts have not been backfilled.
Do not interpret pre-deployment zero signups as zero existing accounts.

**People** use PostHog person IDs after identity merging; verified accounts and
payments use Clerk account IDs. Web and native identify with the same ID.
Account switches and sign-out reset identity. Native launch starts anonymous
until Clerk confirms the account. We do not copy email or names into analytics.

**Active Studio people** use screen visits and product actions, excluding retired
Train events. The Mac's hidden Clerk webview does not create pageviews. Native
foreground heartbeats run at most once per five minutes while the app is active.
This is observed usage, not hours worked or a crash-free rate. Historical web
visits include old Train pages and may include pre-fix native webview activity.

**First observed Mac launch** is the first telemetry-enabled launch for an
installation, including upgrades from uninstrumented versions. It is not an
installation count. Installation UUIDs are separate from account IDs and survive
sign-out. Clearing app preferences produces a new UUID. Version distribution
uses the latest foreground observation per installation in the selected period,
so an upgrading installation does not appear twice. It excludes inactive and
uninstrumented installations; it is not the entire installed base.

**Downloads** come from GitHub's cumulative release-asset counters. Transfers can
repeat and do not identify unique people or successful installs. The table
intentionally ignores the dashboard date range and displays its snapshot time.
It excludes private hand-delivered builds and other hosting providers. The daily
GitHub Actions workflow refreshes at 06:17 UTC. `public-project.json` contains only
the browser-visible `phc_` ingestion token, which cannot read analytics or manage
the project; personal API keys are never checked in. This allows the read-only
GitHub workflow to send counts without adding repository secrets.

**Successful product actions** are HTTP success responses from explicitly
instrumented mutation routes. Reads and prefetches do not count. Scheduled or
accepted publishes are separate from `post_published`, which originates at the
shared provider-confirmed completion boundary. TikTok draft uploads are labeled
`draft_upload`. Completed native workflows mean the operation lease ended;
export completion is separately recorded only after rendering succeeds.

**Payments** deduplicate by Stripe transaction ID. Only `livemode=true` and
positive paid amounts count. Invoices record `amount_paid`; paid credit packs
record Checkout `amount_total`. Amounts remain in currency-specific minor units
(USD/CAD cents, JPY yen). Trials and zero invoices do not count as revenue.
Refunds, fees, tax deductions and provider costs are not tracked here; this is
gross payments, not net revenue or profit. Subscription snapshots are events,
not an authoritative current MRR or active-subscription inventory.

**Sources** use observed UTM source, then referrer, then direct/unknown. A person
may occur in multiple source rows. This is not historical first-touch attribution
or causal ad performance. Browser blockers, unknown referrers and uninstrumented
versions create unavoidable gaps. Geographic data is approximate.

**Privacy:** new events carry action names, counts, durations, outcome codes and
release metadata. They do not carry scripts, prompts, transcripts, project names,
filenames, media or request/response bodies. URL sanitization removes query
parameters except bounded campaign tags and strips fragments. Error messages and
paths are omitted from custom native errors. Existing browser exception capture
remains enabled; replay and autocapture remain disabled.

## Event contract

| Event                                                              | Owner                         | Meaning / key fields                                                       |
| ------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------- |
| `$pageview`                                                        | Web route provider            | Visible web navigation; sanitized URL                                      |
| `studio_screen_viewed`                                             | Web route provider            | Studio route template                                                      |
| `account_signed_in`                                                | Identity boundary             | Account observed signed in; not a new account or necessarily a new session |
| `signup_verified`                                                  | Signed Clerk webhook          | Account creation; stable insert ID and original timestamp                  |
| `studio_entry_clicked`                                             | Web link observer             | Studio CTA intent                                                          |
| `app_release_page_opened`, `app_download_clicked`                  | Web link observer             | Release page versus asset link intent                                      |
| `desktop_handoff_requested`                                        | Web                           | Desktop launch intent; not confirmed launch                                |
| `product_action_completed`, `product_action_failed`                | API wrapper                   | Action, surface, HTTP status, duration, build                              |
| `studio_recording_started/completed/failed`                        | Recorder callbacks            | Actual recorder events; recording UUID                                     |
| `native_first_observed`, `native_app_opened`, `native_app_active`  | macOS app                     | Installation UUID, version, build, commit, OS, architecture                |
| `native_app_updated`                                               | macOS app                     | Version change and previous version                                        |
| `native_screen_viewed`                                             | macOS shell                   | Visible destination                                                        |
| `native_project_created`, `native_media_imported`                  | Native persistence boundaries | Created package / persisted media import                                   |
| `native_action_finished`                                           | Action registry               | Action, outcome, direct or assistant entry point                           |
| `native_operation_started/finished`                                | Operation coordinator         | Operation type, UUID, elapsed seconds                                      |
| `native_export_started/completed/failed/canceled`                  | Export runner                 | Operation UUID; render duration and elapsed time                           |
| `native_error`                                                     | Native handled error boundary | Error domain and numeric code                                              |
| `post_published`                                                   | Shared publish completion     | Platform, job ID, published versus draft upload                            |
| `trial_started`, `purchase_verified`, `subscription_state_changed` | Signed Stripe webhook         | Verified billing state with live-mode marker                               |
| `release_download_snapshot`                                        | Daily GitHub workflow         | Asset ID/name, version, cumulative count, timestamp                        |

New events include `product=studio`, `environment`, and
`analytics_schema_version=1`. Client events include `surface=web|macos`;
native events also include `client=native`, `installation_id`, `app_version`,
`app_build`, `build_commit`, `os_version`, and `architecture`. No first-use data
is fabricated for users of old app builds.

## Maintain the dashboard

Node 22 is recommended. Read credentials only from this repository's `.env.local`:
`POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID=383795`. A worktree may pass
`--credentials-root /absolute/path/to/yapper`.

```sh
node scripts/analytics/dashboard.mjs --check
node scripts/analytics/dashboard.mjs --apply
node scripts/analytics/dashboard.mjs --apply --only versions,builds
node scripts/analytics/downloads.mjs                 # preview counters
node scripts/analytics/downloads.mjs --apply         # capture real counters
```

The updater validates all selected queries before writing, asserts the project,
backs up existing configuration to gitignored `.analytics-private/`, and upserts
its own tagged insights. It preserves unrelated tiles and existing placements.
Use `--reset-layout` only to deliberately apply the checked-in layout. Queries
honor the dashboard date range using PostHog's `{filters}`, except the explicitly
cumulative download table. `--check` takes precedence over `--apply`.

## Rollout and verification

Web/server events begin after the PR deploys. Clerk must deliver `user.created`
to the existing `/api/webhooks/clerk` endpoint, and Stripe must deliver the
existing Checkout/subscription/invoice events to `/api/stripe/webhook`.

The native app uses the official PostHog Swift SDK with a bounded persistent
queue and retries. Plain `swift run`/tests send no telemetry. Packaging defaults
to **development**, excluded from reporting. For a distributable production app:

```sh
YAPPER_ANALYTICS_ENVIRONMENT=production ./native-macos/scripts/package-app.sh
```

Packaging embeds the public ingestion token before signing. Normal release
signing/notarization and distribution still apply. Do not represent source merge
as adoption by existing installations. Development native requests also identify
themselves to the production backend so their action events are excluded.

Verify a real signed-out visitor → sign-in → idea creation → native import →
export → confirmed publish sequence after rollout. Inspect the coverage table
for `surface`, environment, account identity and app version. Never seed fake
production signup, purchase, install or export events to make charts look full.

References: [PostHog dashboard filters](https://posthog.com/docs/product-analytics/dashboards),
[PostHog identity](https://posthog.com/docs/data/anonymous-vs-identified-events),
[Swift SDK](https://github.com/PostHog/posthog-ios),
[Stripe verified webhooks](https://docs.stripe.com/webhooks).
