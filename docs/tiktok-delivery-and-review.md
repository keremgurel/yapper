# Social publishing implementation and review

Inspected 2026-09-07. Implemented, tested and deployed to `https://ypr.app` on 2026-09-07. Vercel confirmed production readiness and 28 recorded migrations, including `0027_social_direct_publishing`. No platform approval or live end-to-end video publication was verified. X and LinkedIn remain future integrations.

## What changed

The macOS shell hosts `https://ypr.app/studio/poster`, so the hosted Poster changes apply without a native rebuild.

### TikTok inbox reliability

Previously, the final upload PUT returning 201 (or `uploaded_bytes` reaching the file size) caused Yapper to display “Sent to drafts.” TikTok processes the video asynchronously after accepting the bytes. Acceptance does not prove inbox delivery.

Yapper now saves the provider's `publish_id` before uploading bytes and checks `/v2/post/publish/status/fetch/`. Only `SEND_TO_USER_INBOX` confirms inbox delivery; `PUBLISH_COMPLETE` confirms an actual post. `FAILED` surfaces the provider's reason. Unavailable or still-processing status remains pending. Polls reuse the original user-scoped idempotency claim; they do not initialize another upload. The client checks up to 24 times at five-second intervals, then offers a status check. Inbox delivery no longer marks the source idea posted.

The five-pending-shares-per-24-hours limit is a plausible cause of the original missing notifications, not a confirmed historical diagnosis. The locally saved production environment did not provide usable database access. No historical production failure reason or real test upload was verified during implementation.

### TikTok Direct Post

Poster retrieves the creator's current posting options, displays their identity and the video preview, and requires an explicit privacy choice and posting consent. Comments, Duet, Stitch, commercial disclosure and AI labeling default off. Creator-disabled interactions cannot be enabled; branded content cannot be private. Captions are editable. Server-side validation repeats the creator and duration checks and binds the attempt to the account that was reviewed.

Direct Post uses `video.publish` and `PULL_FROM_URL` on the verified `ypr.app` domain. A one-hour signed URL serves only the owned video from R2; it exposes no storage credentials. A result is successful only after `PUBLISH_COMPLETE`. The inbox workflow remains an explicit alternative using `video.upload`.

Until audit approval, the server permits only `SELF_ONLY` Direct Post, and TikTok requires the test account to be private. Do not set `TIKTOK_DIRECT_POST_AUDITED=1` merely because the dashboard's Direct Post switch is on.

### Facebook

Each user connects through Facebook OAuth, grants Page access, then explicitly selects their own Page. No Page is selected automatically. The browser receives Page IDs/names only; user and Page tokens stay encrypted server-side. The selection endpoint rechecks Page authorization, and publishing refuses a Page changed since the user reviewed it.

Reels use Graph v26.0: initialize, save the video ID, transfer the hosted video, finish publication, then verify `publishing_phase.status=complete`. A finished transcode alone is not success. Preflight checks vertical aspect ratio, minimum 540 × 960 dimensions and 3–90 second duration. Facebook also requires 24–60 fps, which the provider validates. Page Reels are public; personal-profile posting is not supported by this integration. Facebook can also be selected for scheduled posts. Facebook voice-sample importing is excluded because that separate feature does not have a Facebook media resolver.

### Instagram and YouTube

Both existing integrations already use official direct-publishing APIs. Instagram requires a Professional (Creator or Business) account. General Instagram container failures are no longer incorrectly labeled as proof that the account is personal. YouTube requests public visibility from Poster, but platform verification/audit restrictions remain authoritative; successful upload alone is not evidence that Google has approved public publishing for all users.

## Deploy configuration

1. Apply `drizzle/0027_social_direct_publishing.sql` through the existing migration workflow before serving the new routes. It adds `publish_jobs.provider_state` and Facebook to connection, job, schedule and imported-media constraints. The production deployment applied this migration and confirmed 28 total recorded migrations.
2. Preserve the existing 32-byte, base64 `PUBLISH_TOKEN_KEY`, storage configuration and platform credentials. Do not rotate the encryption key as part of this change.
3. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` for the Meta app containing the Page publishing use case. `FACEBOOK_LOGIN_CONFIG_ID` is optional when using a configured Facebook Login for Business flow. Register `https://ypr.app/api/publish/callback/facebook` and allow `ypr.app` in that app's login settings. Facebook is hidden from connectable destinations until both credentials are present.
4. Request `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`; the server rejects an OAuth grant missing these permissions. Confirm the permissions/configuration with an app-role test account before public rollout.
5. TikTok's default requested scopes now include `video.publish` as well as `video.upload`, `user.info.basic`, `user.info.profile`, `user.info.stats`, and `video.list`. If `TIKTOK_SCOPES` is overridden in deployment settings, include the Direct Post scope there too. Existing users must reconnect to grant the new scope.
6. `TIKTOK_MEDIA_ORIGIN` defaults to `https://ypr.app` and must be HTTPS on a TikTok-verified domain. Verify the exact host in the sandbox as well as production. Confirm TikTok can fetch the signed media route without login or deployment protection.
7. Keep `TIKTOK_DIRECT_POST_AUDITED` unset until the matching app/client has passed its Direct Post audit. Use sandbox credentials and a private sandbox target account for the review recording.
8. Deploy the hosted app, then run real sandbox/test-account flows. Check both the server result and the destination app. Do not advertise public Direct Post or broad Facebook/Instagram access before platform approval.

Local validation: 237 test files / 1,737 tests passed, TypeScript passed, changed-file lint passed, and `npx next build` passed. The production build then ran the normal migration workflow successfully. Public home/privacy/terms and robots checks passed, and an invalid signed media grant returned 404. Authenticated posting remains to be tested with actual sandbox/test accounts.

[Production deployment](https://vercel.com/kerem-gurels-projects/yapper/FdamxoiaXeN7yLFhgG1x9fFEX3AH). Source code is still an uncommitted working-tree change; this was a direct Vercel deployment, not a Git push.

## Developer-console work

### TikTok

- App `7664329094208997396`; sandbox `7664368726431336468`.
- Production started as an empty Draft; the sandbox had the existing integration.
- Imported the sandbox configuration into the production form, removed Share Kit, retained Login Kit + Content Posting API, and enabled Direct Post to match this implementation.
- Existing production domain `ypr.app` is verified. Callback: `https://ypr.app/api/publish/callback/tiktok`.
- Website, description and review explanation were prepared in the form. **Save is blocked by a required demo video; these form changes must not be treated as persisted.** Copy is preserved below.
- Web is the current classification. The macOS wrapper uses the hosted OAuth flow; include the wrapper in the demo and confirm the console's Desktop requirements if submitting it as a separate platform.
- No submission or legal acceptance was performed.

Description (116 characters):

> Yapper helps creators record and edit original videos, prepare captions, and share their work to connected accounts.

Review explanation (984 characters):

> Yapper (https://ypr.app) is a content studio for creators to develop ideas, record and edit original videos, and publish to their connected accounts. The macOS app hosts the same Poster workflow. Login Kit connects TikTok; user.info.basic identifies the account, user.info.profile shows its profile/link, user.info.stats shows account statistics, and video.list shows its public video library. With video.publish, creators preview their video, edit the caption, explicitly choose privacy, interactions and commercial disclosures, accept TikTok's required declarations, and authorize Direct Post. Creator settings are fetched before posting; hosted media uses PULL_FROM_URL on verified ypr.app. Yapper checks processing status before showing success. video.upload offers an explicit inbox workflow, confirmed only after TikTok reports delivery; the creator finishes in TikTok. Users can disconnect in Connections. The sandbox demo shows these flows; unaudited Direct Post uses Only me.

### Meta

- Yapper app `1608889560955742`, OCX Software Inc.; currently unpublished.
- Added “Manage everything on your Page” alongside the existing Instagram and Threads use cases.
- Registered `https://ypr.app/api/publish/callback/facebook`, preserving the existing Instagram callback. Production Facebook app credentials are still missing, so Facebook is not yet available to connect.
- Added `pages_show_list`, `pages_manage_posts` and `pages_read_engagement` for testing, including Meta’s confirmation that the shared read permission also applies to the Instagram use case.
- Privacy, terms and deletion-instructions URLs now point to `https://ypr.app/privacy`, `https://ypr.app/terms`, and `https://ypr.app/privacy`; confirmed after reopening Basic settings. Category is Utility & productivity. Confirm contact email and add the app icon before review.
- App dashboard requires Tech Provider/access verification to request access to other users' business data. App review/test API calls and actual Instagram/Facebook screencasts remain required. No review submission was performed.

### Google / YouTube

- Correct account: `the.ypr.app@gmail.com`. Project `yapper-502200`, number `471533681107`, matching the local YouTube client configuration.
- Branding is now verified and published. The Verification Center confirms “Your branding has been verified and is being shown to users.” Data access for `youtube.upload` and `youtube.readonly` remains unverified.
- Resolved the previous homepage-ownership rejection on September 7, 2026. Added the Google verification TXT record for `ypr.app` through Cloudflare's one-time authorization. Search Console, signed in as `the.ypr.app@gmail.com`, now explicitly confirms “You are a verified owner” and “Successfully verified” for the DNS-level domain property.
- Selected “I have fixed the issues”, requested branding re-verification, received approval, and clicked “Publish branding”. Confirmed the published status in both Branding and Verification Center.
- Updated privacy and terms links from HTTP to HTTPS. Google explicitly confirmed “Branding changes saved!”
- Opened data-access review preparation. Google requires a scope justification and a YouTube demo link covering all OAuth clients assigned to this project. The justification below is filled in the browser, but saving has not been confirmed; the required demo link remains empty. No data-access review was submitted.
- OAuth verification and the YouTube API compliance audit are separate. The latter's approval has not been verified in this task.

Corrected scope justification for submission (the earlier browser draft still needs this correction):

> Yapper is a content studio at https://ypr.app, also available through its macOS app. youtube.upload lets a creator upload an original video they selected in Poster to their connected YouTube channel, with their reviewed title and description, immediately or at a scheduled time. The current Poster requests public visibility. A read-only scope cannot upload video. youtube.readonly identifies the authorized channel and displays its uploads, titles, thumbnails, view counts, durations and privacy status in the content library. It also reads public video metadata for creator feeds selected by the user. An API key cannot identify the authenticated channel or retrieve its non-public uploads. These scopes provide upload and read access without broader YouTube account-management permissions. Users can disconnect YouTube in Connections.

## Recording plan

See [platform-review-demo.md](./platform-review-demo.md). Record real UI and real results after the new version is deployed. The talking-head overview can be recorded first; the posting footage depends on working sandbox/test-account configuration.

## Known recovery limits

The database retains provider IDs and account bindings for the new workflows, but the sheet's attempt keys currently live in memory. Closing/reopening creates a new attempt; there is no cross-session publish-history UI, automatic historical reconciliation, new background poller or webhook in this change. Keep an uncertain attempt open and use Check publish status. Do not create a fresh attempt merely because the destination is still processing.

A timeout that loses the provider's initialization response cannot be reconciled automatically without its publish ID. Facebook interruption between upload and finish can also require operator reconciliation of the existing video. These cases remain pending rather than inviting duplicate posts. Scheduling TikTok Direct Post is not enabled: it requires freshly reviewed creator settings and consent. Existing inbox schedules remain inbox schedules.

## Official references

- [TikTok status API](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status)
- [TikTok upload API and pending-share limits](https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video)
- [TikTok Direct Post guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
- [TikTok media transfer](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide/)
- [TikTok review guidelines](https://developers.tiktok.com/doc/app-review-guidelines)
- [Facebook Reels publishing](https://developers.facebook.com/documentation/video-api/guides/reels-publishing)
- [Google branding verification issues](https://support.google.com/cloud/answer/13807376)
- [YouTube videos.insert restrictions](https://developers.google.com/youtube/v3/docs/videos/insert)
