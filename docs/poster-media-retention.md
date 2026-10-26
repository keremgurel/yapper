# Poster video retention

Poster is temporary publishing storage. Each account may have one waiting video,
plus files needed by scheduled posts, active publishing, or bounded processing.
Scripts, transcripts, ideas, and feedback survive video cleanup. Brand logos are
outside this policy.

The upload/import preflight is a convenience check. The authoritative check runs
inside `activateObjectWithinTx`, under the per-user storage lock shared with
registration and scheduling. Two uploads can receive URLs concurrently, but only
one can become a new waiting video. The loser returns `poster_slot_busy`; pending
uploads remain subject to the existing upload-expiry worker. Same-file retries
and shared submission/import references do not consume another slot.

Daily maintenance repairs legacy excess uploads/imports by retaining the newest
waiting physical object per account and releasing older ones. Published and
scheduled files do not displace the waiting video. Discovery deduplicates object
keys and release rechecks eligibility inside the transaction. An active publish,
active schedule (including needs-attention), recent publishing attempt, recent
submission, or unexpired processing lease protects the file. Transcription leases
cover the route's full time budget. Active publishing must reach a terminal state
before automatic release; age alone is not evidence that it is safe to delete.

Published media is eligible 24 hours after all destinations finish, provided at
least one succeeded and no schedule still needs it. Removing a durable reference
refunds each physical object's quota once, clears only media links, and enqueues
physical deletion through the existing leased worker. That worker retries failed
deletions. The storage counter changing is not proof of physical deletion.

## Account repair

Run the repair script with configured database and R2 credentials. It previews by
default and requires an exact account ID; it does not infer which user to modify.

```sh
node --env-file=.env.local --import tsx scripts/cleanup-poster-media.ts --user-id USER
node --env-file=.env.local --import tsx scripts/cleanup-poster-media.ts --user-id USER --apply
```

Apply rechecks candidates, releases eligible excess videos, drains only that
account's deletion queue, and verifies the released files are absent with R2 HEAD
requests. It reports retained bytes and any incomplete deletions. The latest
waiting video stays even if it is old; posting, scheduling, or explicitly
discarding it frees the slot.

## Attach originals from channel posts

YouTube posts without retained media can be selected in Poster.
Their cards say “Attach original video”; opening one asks for a local original
file rather than downloading platform media. Attachment uses the same upload,
entitlement, storage quota, waiting-slot and lifecycle checks as Add video.
The post title becomes the upload title, and its caption is retained as the
upload's original note and copied into the current cross-post drafts without
overwriting edits made while the upload runs. YouTube descriptions and TikTok
video descriptions are included in the connected library response.

The attached file appears in Uploads. During the current Poster session,
reopening the source card reuses the attachment; after reloading, use Uploads.
Source-card associations and edited cross-post drafts are session state, not
permanent platform imports. Published-media retention still applies.
Instagram keeps its existing import flow. TikTok automatic importing is described
below. No new OAuth permissions or automatic YouTube downloads are introduced.

## TikTok automatic imports

TikTok now follows Instagram's automatic import interaction when a source card
is selected. The server first checks entitlement, a verified saved copy, storage
and the waiting slot. For a fresh file, TikTok's authenticated `video/query`
verifies ownership and supplies the canonical post URL. Caller-supplied URLs are
never accepted. A bounded first-party public-page lookup can provide the file
without Apify; when unavailable, one bounded Apify video request is permitted.

The fallback imports one video, with related posts, covers, subtitles and
transcription disabled. It uses `maxTotalChargeUsd=0.02`, `maxItems=1` and
`restartOnError=false`. There is no app-level retry. DB-backed pacing allows at
most two paid admissions within a 150-second import workflow and one per user,
with a five-minute same-post cooldown. This pacing is intentionally conservative.

Separate fixed-UTC-day/month reservations default to $1/day and $20/month for
this feature, using a conservative $0.02 reservation per paid attempt. These are
admission budgets, not exact provider invoices. Existing shared provider limits
also apply. `TIKTOK_IMPORT_DAILY_BUDGET_USD` and
`TIKTOK_IMPORT_MONTHLY_BUDGET_USD` can lower these defaults; zero stops the paid
fallback, and invalid settings fail closed. First-party imports and verified
cached files do not spend the Apify budget. Cache validation precedes all paid
work, and reservations are not refunded on ambiguous failures.

Downloaded bytes use the same streaming size/time limits, quota registration,
unique attempt keys, race-loser cleanup and lifecycle as Instagram. Every media
redirect is restricted to allowed provider hosts. The Apify credential is sent
only to its key-value record endpoint, never to TikTok/CDN redirects. A new file
is selected for cross-post preparation; nothing is published automatically.
YouTube continues to use local original attachments. See
[youtube-download-approval.md](youtube-download-approval.md) for the separate
YouTube request and official export alternative.
