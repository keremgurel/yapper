# Storage decisions for public usage

Reviewed 2026-09-12. Source-code audit and planning scenarios; not a measurement of production bytes or invoices. This supersedes the storage conclusions in `storage-economics.md` dated 2026-08-27 and expands `public-billing-design.md`. No files belonging to users, bucket policies, subscriptions, or production settings were changed.

The architectural recommendation is to keep editing local, preserve useful text in Postgres, and make every cloud binary either an explicitly saved asset or a temporary asset with a deletion deadline. Credits fund processing. The subscription funds a finite amount of ongoing storage. Purchased processing credits must not create an indefinite storage obligation.

## Merge review (2026-09-20)

This document records architecture and retention proposals; merging it does not
change storage quotas, bucket lifecycle rules, or delete customer data. R2's
published storage and operation rates were rechecked against the linked
pricing page. Other provider scenarios remain dated planning assumptions.
Production usage, invoices, and external lifecycle settings remain unverified.

## What we store today

| Data                                                                                 | When it is stored                                  | Location                                                                                                                                                                                             | Current lifetime / limitation                                                                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Native project packages and packaged source media                                    | Import, edit, save, duplicate a native project     | User's Mac; project library defaults to `~/Movies/Yapper Projects`, with support data under `~/Library/Application Support/Yapper Studio Native` and waveform caches under the macOS cache directory | Local files; no Yapper cloud byte cost. Source URLs may reference original files or packaged copies.                                  |
| Unsaved idea text                                                                    | Typing in the browser composer                     | Browser localStorage                                                                                                                                                                                 | Persists until the draft is cleared; device-local.                                                                                    |
| Dictation audio                                                                      | While the microphone records                       | Browser memory                                                                                                                                                                                       | Not currently durable; losing the page or a failed transcription can lose the take.                                                   |
| Small transcription uploads                                                          | Stop dictating / request transcription             | Request body through the application function and provider                                                                                                                                           | No R2 upload on this path. Provider handling is separate from our storage.                                                            |
| Larger dictation audio and native transcription audio                                | Before cloud transcription                         | Cloudflare R2; `u/<user>/asr/<id>.m4a`                                                                                                                                                               | Deleted on handled completion/failure; lacks registry tracking and guaranteed cleanup of abandoned/preflight-rejected requests.       |
| Saved browser takes, uploaded videos, native Poster exports                          | Save a take, add a video, send an export to Poster | R2; `u/<user>/<id>.<ext>`                                                                                                                                                                            | Durable submission reference; no general age-based expiry found. This includes saved browser source takes, not only finished exports. |
| Imported social video masters                                                        | Import an Instagram video for reuse/publishing     | R2 plus `imported_platform_media` in Postgres                                                                                                                                                        | Reused by platform post id; import row is a durable reference with no general TTL found.                                              |
| Uploaded publishing thumbnails                                                       | Selected thumbnail is uploaded for publishing      | R2, tracked as `thumbnail`                                                                                                                                                                           | Initially eligible after 24 hours; scheduling can extend protection. Actual deletion depends on cleanup throughput.                   |
| Brand logos                                                                          | User uploads a brand asset                         | R2 plus `brand_assets` row                                                                                                                                                                           | Durable while referenced; user deletion queues physical removal.                                                                      |
| Generated scene images / thumbnails                                                  | Generate AI artwork                                | Provider response through application memory to client; native scene assets saved locally                                                                                                            | Generation alone does not automatically write these binaries to our R2. A subsequent publishing upload can.                           |
| Ideas, scripts, transcripts, feedback, Brain notes/chunks, chat, dictionary          | Save content / complete workflows                  | Neon Postgres via `DATABASE_URL`                                                                                                                                                                     | Durable application records; some derived content duplicates source text.                                                             |
| Credits, publishing schedules/jobs, connections, planning responses, object registry | Billing and workflow execution                     | Neon Postgres                                                                                                                                                                                        | Operational history accumulates; different classes need different retention policies.                                                 |
| Downloaded media used in publishing/import                                           | Server must forward a file to another platform     | Temporary disk in the application runtime                                                                                                                                                            | Bounded file helpers and cleanup exist; transfer and compute still cost money.                                                        |

R2 uses the configured `R2_BUCKET`, falling back to `yapper-media`. This is a source default, not confirmation of the deployed bucket name, region, lifecycle rules, or storage total. Neon connection configuration is likewise not proof of the deployed plan. External AI services receive selected media/text for processing; audit their account-level retention settings separately before making end-to-end deletion promises.

## What is already sound

Large saved files use presigned direct-to-R2 uploads. Pending durable uploads reserve bytes under a user lock; signatures bind upload length and activation verifies the object. The active quota counter counts a physical object once even when multiple rows refer to it. A leased deletion worker separates database changes from physical deletion, rechecks live references, and retries failures. Account deletion queues registered media before database cascades. Keep these foundations.

Local project packages, export rendering, waveform caches, and local generated overlays should remain local. Cloud synchronization of an entire native project would be a new paid storage product, not an incidental consequence of editing.

## Specific waste and scaling gaps

1. **Scratch ASR is outside the registry.** `transcriptionKey` writes under each user's `asr` directory; the ticket route does not call `allocatePendingObject`. The worker discovers registry rows, not arbitrary bucket objects. A client that uploads and never calls transcription leaves an object the worker cannot discover. Deletion before provider work is also not guaranteed. Account deletion does not enumerate these unregistered objects. Existing external bucket lifecycle configuration has not been inspected.

2. **Cleanup capacity is insufficient as a guaranteed backstop.** `vercel.json` invokes `/api/internal/r2-lifecycle` once daily with its default limit of ten objects. Normal submission/logo deletions may additionally drain five after the response. Those opportunistic runs help but do not provide reliable capacity for abandoned uploads, account deletion, or a large backlog. The route also removes at most 500 expired rate-limit rows per scheduled run.

3. **An import cache can retain a video after history deletion.** Deleting the last submission explicitly keeps the object and quota if `imported_platform_media` still references it. The only cache invalidation found is for a missing R2 object. Users need a way to delete the actual stored asset, not merely one visible reference. A reuse cache should not silently become permanent archival storage.

4. **Cancellation changes quota, not retained bytes.** `storageQuotaFor` gives a lapsed user the free quota, but no general expiry of their previously stored media was found. A user with 50 GiB does not become a 2 GiB storage bill because the UI quota dropped. Their retained bytes continue costing money until physically deleted.

5. **Quota release is not provider cost release.** The app releases active quota when a final reference is removed; physical deletion happens later. Track active, pending, expired/deletion-pending, and physical bytes separately. Otherwise rapid upload/delete cycles can build provider bytes while the user appears below quota.

6. **A media proxy creates a second cost path.** `/api/tiktok-media/[token]` streams R2 through a Vercel function, with range requests. This may be needed for the platform's URL requirements, but it is not equivalent to a direct R2 download. Avoid making this the ordinary playback/download path. If a stable verified hostname is required for platform pulls, evaluate a narrowly scoped Cloudflare Worker backed by R2; it still needs authentication grants, request accounting, and platform verification.

7. **The workspace-size UI is not a database invoice.** It estimates selected user rows with `pg_column_size`. It omits other tables, indexes, history/backups, and some physical storage effects. Persisted planning responses and operational histories have no general pruning policy found. Ideas listing currently returns up to 500 rows including script/note text; long-lived accounts need summary projections and pagination, not merely more disk.

8. **Duplication is only partly handled.** References to the same object are counted once and imports reuse a platform post id, but arbitrary uploads get random keys. Repeatedly uploading the same export can create separate stored objects. Use stable per-user asset/version ids and upload idempotency first; consider verified per-user content hashes later. Avoid global cross-account deduplication and its ownership/deletion complexity.

## Retention policy to build

All durations below are proposed customer-facing defaults, not active deletion settings. Apply prospectively and explain any migration before changing existing saved data.

| Asset class                             | Proposed retention                                                                                           | User experience / dependency rule                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local in-progress recording             | Until saved, exported or explicitly discarded                                                                | Persist incrementally on device; no arbitrary timer or silent loss. Surface local-disk failures with recoverable completed audio.                                                                      |
| Cloud transcription scratch             | Delete immediately after durable transcript delivery; recoverable jobs at most 24 hours from upload          | Keep local audio as recovery source. Hard expiry releases abandoned copies; resume after expiry by reuploading.                                                                                        |
| Abandoned durable upload                | Signed upload lifetime plus completion grace, normally no longer than 24 hours                               | Do not delete while a valid upload can still finish. Resume later from the local source.                                                                                                               |
| Publish-only master                     | Seven days after the last destination reaches a terminal result                                              | Keep through every scheduled destination, active upload and bounded retry window. Show the deletion date and a “Keep in library” option.                                                               |
| Imported master used only to cross-post | Same seven-day policy                                                                                        | Retain post id, caption, source URL and publish result; expire binary/cache reference together. Pinning promotes it to saved media.                                                                    |
| Explicitly saved cloud-library asset    | Until the user deletes it or the documented account-retention policy applies                                 | Counts against subscription quota. Never treat an intentional save as a disposable cache.                                                                                                              |
| Transient thumbnails / previews         | 24 hours after final dependent job; immediate cleanup when abandoned where safe                              | Future scheduled posts extend protection; reusable brand assets are durable.                                                                                                                           |
| Canceled paid account's cloud media     | Proposed 30-day read/download grace after paid access ends                                                   | Notify before expiry; renew, export, or explicitly choose files that fit any available free allowance. Premium grant expiry follows the same policy. Never randomly choose which user files to remove. |
| User-deleted assets                     | Revoke new access immediately; enqueue physical deletion immediately                                         | Target deletion within one hour; alert if overdue. Already issued signed links can remain usable until expiry or physical deletion.                                                                    |
| Operational payloads and derived caches | Proposed 30 days for detailed completed-job/provider payloads; 90 days for retry/idempotency response bodies | Keep compact outcome/idempotency records longer so expired response caching does not permit duplicate charges. User-authored text is not an operational cache.                                         |

Billing/audit metadata needs a separately reviewed retention policy; do not indiscriminately delete financial records alongside debug payloads. Database restore windows can retain historical data after a logical delete. Document that boundary rather than promising immediate erasure from backups.

Put scratch audio in a dedicated temporary bucket or a top-level `tmp/asr/` prefix. The existing `u/<user>/asr/` layout cannot be covered by one simple shared ASR-prefix rule. Keep immediate application deletion, with bucket expiry as a failure backstop. R2 supports prefix-scoped lifecycle expiration; removal is asynchronous and typically occurs within 24 hours of the expiration value. Never attach a blanket TTL to a prefix containing saved assets. [R2 lifecycle documentation](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

Do not put scheduled publishing masters in an unconditional short-TTL bucket. Their lifetime is determined by all future dependencies, not just upload age. Use a common reference/dependency model with object version, purpose, byte count, owner, expiry, pending upload reservation and deletion status. Expiry must check every destination and schedule atomically before deleting.

## Cost model at thousands of users

Use decimal GB for provider billing; current app quotas use GiB. R2 Standard lists $0.015/GB-month, $4.50/million Class A operations, $0.36/million Class B operations and no internet egress charge. Shared free allowances are excluded here. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

| Average retained media per user | 1,000 users: storage/month | 10,000 users: storage/month |
| ------------------------------- | -------------------------: | --------------------------: |
| 1 GB                            |                        $15 |                        $150 |
| 5 GB                            |                        $75 |                        $750 |
| 20 GB                           |                       $300 |                      $3,000 |
| Full 50 GiB quota               |                       $805 |                      $8,053 |
| Full 100 GiB quota              |                     $1,611 |                     $16,106 |

These are storage-only planning calculations, not total operating cost. User count alone is not the driver: retained bytes, churn, replay/transfer volume and paid conversion matter.

Assume 10,000 active users each produce twenty 150 MB videos/month: 30 TB of new binaries monthly. With uniform arrivals and no saved-library promotions, retaining publish-only copies for seven days stabilizes near 7 TB, about $105/month. Thirty days gives 30 TB/$450. Keeping every copy for twelve 30-day months reaches 360 TB and a $5,400/month run rate at the end; the twelfth month's average balance is lower. Scheduled jobs, pins, duplicate versions and cleanup lag add to those figures. This illustrates retention, not a measured user distribution.

Neon's official pricing material lists database storage at $0.35/GB-month and Launch compute at $0.106/CU-hour; verify the actual plan and history settings before budgeting. At an assumed 10 MB of physical DB storage per user, 10,000 users mean 100 GB/$35 monthly for storage alone; at 100 MB each, $350. Indexes, write history and compute can dominate compact text. Do not store media/base64 or full provider responses in relational rows. [Neon pricing](https://neon.com/pricing), [Neon compute pricing announcement](https://neon.com/blog/major-compute-price-reduction-on-neon)

Vercel meters application/CDN transfer independently. Its regional table includes $0.15/GB on-demand Fast Data Transfer; 30 TB of billable transfer at that illustrative rate is $4,500, before origin transfer, compute or requests and before allowances. This is a conditional transfer scenario, not a claim that every R2/platform transfer takes that path. Trace the actual route. [Vercel CDN pricing](https://vercel.com/docs/manage-cdn-usage)

Other costs belong in the same model: provider attempts, publish forwarding, DB compute/pooling, authentication, emails, log retention, payment fees, refunds and support. Build small thumbnails once for video grids instead of downloading many full videos just to show their first frame. Keep a single master for multiple destinations unless a platform actually requires a different rendition. Bound concurrent transcoding and platform uploads separately from account count.

## Implications for pricing

Retain the subscription-plus-credits structure, with **two visible meters: credits and cloud storage**. A plan supplies recurring storage entitlement plus recurring processing credits. A top-up adds processing credits only. Additional storage, if needed, is a recurring add-on with a clear byte limit; a one-time payment cannot responsibly promise storage forever.

The previously proposed 50 GiB at $24.99/month has about $0.81/month of raw storage exposure at full quota. That is workable when explicitly bounded. Keep annual storage equal to monthly; the existing 100 GiB annual bonus doubles storage exposure on a plan already discounted. Do not label quota as storage allocated in advance: an unused quota costs no object-storage bytes.

Example mixed population: 10,000 accounts, 1,000 paying $24.99 monthly and consuming all 500 credits at a provisional $0.006 provider budget, with every paid account at 50 GiB and 9,000 free/lapsed accounts at 2 GiB. Monthly components are approximately $24,990 revenue, $3,000 provider work, $805 paid storage and $290 free/lapsed storage. The prior illustrative US domestic Stripe fee assumption adds $1,200, leaving $19,695 before DB, compute, auth, transfer, support and other costs. This is an assumption-driven scenario, not margin validation. Current lapsed accounts can retain more than 2 GiB, so the existing implementation can exceed this storage model.

Use this per-plan constraint before publishing credit prices:

`provider budget = net revenue − target contribution − storage reserve − other variable operating costs`

Then divide by credits supplied, including permitted rollover and free/promotional exposure. Measure high-cost mixes and annual discounts. Publishing credits should also cover any unavoidable per-publish transfer/processing costs, while storage is funded by recurring membership. Do not separately charge twice for the same shared master.

For free accounts, recommend local capture and useful text access without an ongoing large-video hosting promise. Trials can have a small temporary cloud quota; gifted premium receives a plan-equivalent quota until its expiry. All nonpaying retained data and gifted processing must have a funded acquisition/support budget. Changing the existing 2 GiB fallback requires a migration and communication plan.

## Required work before public release

1. Track and expire scratch audio; verify actual bucket lifecycle settings. Ensure canceled/rejected jobs and account deletion cannot leave untracked binaries.
2. Add explicit saved-versus-publish-only ownership, expiry and dependency protection; make deleting an imported asset remove its durable cache reference when appropriate.
3. Replace the tiny daily backstop with a durable deletion queue processed continuously or at least every few minutes. Keep leases, retries and reference checks. A design target of ten objects/second gives 36,000/hour; measure DB/provider throughput rather than assuming this capacity. Alert on oldest due object, queued bytes and error rate. A 10,000-object backlog must not depend on another thousand days of the current scheduled run.
4. Give cancelation and grant expiry a documented grace/retention workflow; count lapsed bytes in forecasts. Implement user-visible download and deletion before imposing expiry.
5. Add daily physical-versus-logical inventory reconciliation and attributed byte-day accounting. Track pending, active, temporary and deletion-pending bytes separately, plus ingress/egress and per-feature requests. A periodic inventory can find historical orphans; do not make every page view list a whole bucket.
6. Keep normal upload/download/playback on signed object delivery. Measure the TikTok proxy separately and move large-file transfer off app functions where platform requirements allow.
7. Add summaries/pagination, bounded attachment sizes and retention for derived/operational data. Measure physical DB size, index growth, history and query time. The existing pooled connection string helps, but ten connections per serverless instance is not a global concurrency budget.
8. Run failure/load checks: interrupted upload, valid late PUT, cancelation during transcription, deletion during scheduled publishing, account deletion with many assets, concurrent quota use, retries, and a 10,000-object deletion backlog. Verify physical deletion, not merely a zero quota counter.

Before making a production savings claim, obtain an aggregate inventory by purpose/age/account state, oldest deletion age, orphan bytes, destination transfer volumes, physical database/table/index/history sizes, and actual provider invoices. This audit deliberately does not infer those measurements from repository defaults.

## Source map

- Objects and keys: `src/lib/r2.ts`.
- Durable upload reservations: `src/app/api/media/upload-url/route.ts`, `src/lib/db/storage-accounting.ts`.
- Scratch audio: `src/app/api/transcribe/upload-url/route.ts`, `src/app/api/transcribe/route.ts`.
- Deletion registry/worker: `src/lib/db/r2-lifecycle.ts`, `src/lib/db/r2-drain.ts`, `src/app/api/internal/r2-lifecycle/route.ts`, `vercel.json`.
- Import persistence and history deletion: `src/lib/db/imported-media.ts`, `src/lib/publish/server/instagram-import.ts`, `src/app/api/submissions/[id]/route.ts`.
- Quotas/account removal: `src/lib/billing/storage.ts`, `src/lib/billing/plans.ts`, `src/lib/db/users.ts`.
- DB accounting: `src/lib/db/schema.ts`, `src/lib/db/storage-usage.ts`, `src/lib/db/client.ts`.
- Native file storage: `native-macos/Sources/YapperNative/Services/Projects/ProjectLibrary.swift`, `Services/ProjectStore.swift`, `Services/Scene/GeneratedOverlayService.swift`.
- Publishing file path: `src/lib/studio/save-take.ts`, `src/hooks/use-add-video.ts`, `src/app/api/tiktok-media/[token]/route.ts`, `src/lib/db/publishing-schedules.ts`.
