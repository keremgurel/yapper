# Publishing rollout — October 23, 2026

## Current gates

This is a readiness ledger, not blanket production certification. Google was rechecked on October 22: branding is verified, scope access is unverified, and the submission summary still reports a missing demo video. Meta was also rechecked live on October 22 after the owner completed sign-in. Verification, app settings, data handling and reviewer instructions show 100%; allowed usage remains incomplete because the three permission screencasts are absent. No YouTube or Instagram review recordings have been supplied in this task.

| Platform  | Verified state                                                                                                                                                                                                                                                                  | Remaining work                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| YouTube   | Google project `yapper-502200`: branding verified. `youtube.upload` and `youtube.readonly` unverified. Scope justification already saved. Web and current native source include visibility, audience and synthetic-media controls.                                              | Record the real authorization/read/upload flow, verify the result in YouTube Studio, provide a working unlisted demo link, submit scope verification, and resolve Google's feedback.                                                       |
| Instagram | Meta app `1608889560955742` unpublished; App Review not submitted. Connected OCX Software Inc. business portfolio is verified. Privacy URL and app category present. All three permission descriptions are saved; publishing and insights API-test requirements show Completed. | Record and attach permission demonstrations, rehearse the reviewer login and real publishing/insights flows, then submit review and publish after approval. Saved form completeness is not proof that the integration works for reviewers. |
| TikTok    | Direct Post audit approved October 19 for app `7664329094208997396`; production flag enabled and public posting verified end to end.                                                                                                                                            | Public test `7698419574521351445` played from another TikTok account. The owner subsequently deleted it. Scheduling remains separate.                                                                                                      |
| Facebook  | Paused in the product.                                                                                                                                                                                                                                                          | No review or recording work needed until explicitly re-enabled.                                                                                                                                                                            |

The [Google review summary](https://console.cloud.google.com/auth/verification?project=yapper-502200) explicitly blocks confirmation because the demo video is missing. The [Meta review draft](https://developers.facebook.com/apps/1608889560955742/app-review/submissions/) asks for screencasts for all three Instagram permissions, and shows the publishing and insights API-test requirements as Completed. The data-handling form now lists Apify, Surplus, OpenAI, Neon, Cloudflare and Vercel. The controller is OCX Software Inc., Canada. The national-security answer is No, and the four request-handling procedures confirmed by the owner are selected. These are saved declarations; this check did not independently certify every vendor processing-country list. The Facebook Page permissions and public_profile were removed from the review draft; only instagram_business_basic, instagram_business_content_publish and instagram_business_manage_insights remain. The underlying Facebook app use case and credentials were preserved. No provider review was submitted in this change.

## Review evidence to produce next

Use the prepared [YouTube script](platform-review-recordings/youtube.md), [Instagram script](platform-review-recordings/instagram.md) and [sample preparation](platform-review-recordings/00-setup.md). Each recording should show real consent, the connected identity, data read by the requested permissions, the reviewed post settings, the final publish action, the actual destination result, and disconnect. Use an original clip selected by the owner. An Instagram demo publishes a real Reel; an unlisted YouTube test upload also creates a real video.

For YouTube, cover all active OAuth clients assigned to the project. Verify the actual visibility in Studio. The [current upload reference](https://developers.google.com/youtube/v3/docs/videos/insert) says unverified API projects are not automatically restricted to private viewing. OAuth scope verification and a requested compliance/quota audit are separate processes.

For Instagram, demonstrate a professional account and a real, non-fallback insights value. The integration uses Instagram Login directly; it does not require a Facebook Page. The permission explanations can use this accurate scope:

- `instagram_business_basic`: identify the connected professional account and show its own media library, including video captions and thumbnails, so the creator can choose source content.
- `instagram_business_content_publish`: publish the creator's selected original video as a Reel only after they review the account and caption and confirm publishing in Poster.
- `instagram_business_manage_insights`: show view metrics for the connected account's media in Poster and Home so the creator can review performance.

Do not certify successful tests, invent screencast links, or complete organizational data-handling answers without evidence. All three allowed-use acknowledgements are already selected in the saved Meta draft. Both publishing and insights API-test requirements show Completed. No screencast has been attached, and no submission has been made.

## Facebook pause and reversal

`src/lib/publish/availability.ts` controls the active web/server platform list. Native `PublishPlatform.enabledCases` mirrors it. Facebook credentials, provider code, database enum values, stored tokens, historical posts and disconnect API remain intact.

The pause removes Facebook from Connections, Home, source and destination pickers, caption generation and cross-post defaults. The connections API filters it for older clients. Direct OAuth URLs/callbacks, Page reads/selection, video-library reads, new publish requests and schedule creation cannot activate it. Existing Facebook schedule executions use the same guarded publisher and fail with `platform_paused` instead of sending a new post. Posts already sent can still be reconciled without starting a new publication.

To resume, add Facebook to both active lists, run the rollout/regression tests, and separately complete provider review and a real Page publishing test. Merely having environment credentials does not re-enable it.

## Scheduled cross-posting

Manual posting code and scheduled automation readiness are separate. The deployment inspected during this work does not have `STUDIO_SCHEDULER_ENABLED` set. `vercel.json` only registers the daily storage lifecycle cron, not the publishing worker. A suitable worker trigger, configured secrets and a successful scheduled delivery/recovery test are still required before calling unattended cross-posting production-ready. No hosting upgrade or scheduler activation is included here.

## October 22 technical verification

The production Connections page still shows the existing YouTube, TikTok and Instagram accounts connected. This alone does not establish successful YouTube or Instagram publishing. Current native source already has YouTube visibility, audience and synthetic-media controls; the earlier October 10 native-control limitation is obsolete.

The Google connection implementation now rejects incomplete `youtube.upload` / `youtube.readonly` grants, missing offline refresh credentials and unidentified channels before saving. Provider and callback tests verify that rejected reconnects leave the existing stored connection untouched. This does not revoke existing Google grants or complete OAuth review.

Remaining production work includes a real YouTube/Instagram posting rehearsal, a browser check of the dedicated reviewer login, the missing review recordings, and provider-side revocation / retained-platform-data behavior. Disconnect currently deletes the stored connection; it does not call Google's revocation endpoint. Google revocation affects every OAuth client in the same project, including the website login client, so that flow needs deliberate product behavior and testing before changing it. The current Google scope justification accurately tells users they can revoke authorization in their Google account.

The owner explicitly reconfirmed on October 22 that Facebook stays paused while Instagram and YouTube are finished. Do not restore it merely because credentials exist. Scheduling remains deferred; a calendar entry is not proof of unattended delivery.

## October 22 reviewer-access correction

Meta's dedicated reviewer account and credentials were already present in the review draft; do not copy its password into repository files. The existing complimentary Stripe subscription had been scheduled to end on October 15, 2027, which would be short of one year after a new submission. Its trial and automatic cancellation were extended together to December 1, 2027 at 00:00 UTC. The resulting invoice total, amount due and amount paid were all zero. The production database received the new period end through the normal Stripe webhook. No manual credits were granted.

The Meta reviewer instructions were updated to the matching date. Submit before December 1, 2026 or extend access again so reviewers retain a full year. The reviewer uses their own Instagram professional account; no personal Instagram credentials are supplied. Real reviewer sign-in remains to be rehearsed.

PR #303 added Google grant/channel validation, passed CI and deployed successfully on October 22. After the owner signed in as `the.ypr.app+qa@gmail.com`, production Connections loaded with YouTube, TikTok and Instagram available and Facebook absent. An invalid-state YouTube callback returned the expected connection error; the QA account remained without connected channels. The original testing instructions incorrectly used Clerk’s reserved `+clerk_test` address on production; after the owner encountered its validation rejection, `docs/testing.md` was corrected to use an ordinary alias for production. Local signed-in navigation and invalid-state rejection passed; full-grant and incomplete-grant callback paths passed automated tests. These checks do not establish successful real provider posting.

## October 23 connection hardening and launch blockers

Both review consoles were rechecked. Their video blockers remain unchanged. Google has two clients: Yapper Website Login and Yapper website YT publish. Meta has three permission uploads; all three explicitly require OAuth footage. The recording pack now covers these without requiring a native-editor, AI-generation, Facebook or scheduling walkthrough.

This branch adds Instagram's documented `data` token envelope alongside the legacy flat response, validates all three granted scopes, requires a valid long-lived token, and rejects failed/empty identity lookups. Rejected reconnects must not replace a working stored connection. Source: [Meta Business Login token exchange](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login).

YouTube Disconnect now requests Google revocation before removing the stored credential, retains the credential for retry on provider failure, and clears the browser's cached channel list after success. Google revokes the combined project grant, so the Connections copy explains that website sign-in may ask for authorization again. This is a code change, not evidence that a live grant has been revoked successfully.

The technical cleanup is now implemented in PR #307:

- Disconnect revokes Google first, then erases the connection and YouTube provider IDs/URLs/account metadata in one transaction. Account deletion also revokes Google before the user cascade; failures retain retry credentials.
- Daily authenticated maintenance validates unattended Google grants and refreshes channel identity, detects `invalid_grant`, and removes rejected credentials plus their retained provider data. Configuration/network failures remain retryable. Unverified connections and retained publish metadata have a conservative 25-day limit; maintenance backlog/failure returns HTTP 503.
- Historical orphan publish data is swept too. Creator-owned source files, captions, saved links and notes remain. Publish idempotency tombstones prevent late provider responses from recreating deleted metadata or duplicating an old intent.
- YouTube Inspiration metadata is session-only. Legacy localStorage metadata is removed when that browser next opens the library; an offline device cannot be remotely wiped. Open tabs clear on disconnect and hourly expiry. The server channel cache expires after one minute and discards responses arriving after a connection changes.
- Poster distinguishes unavailable Instagram insights (dash with an accessible explanation) from a confirmed numeric zero.

**Technical deployment is not provider approval or proof of a live account's successful upload.** Remaining owner rehearsal and review steps:

- Owner connects the intended YouTube channel and eligible Instagram Professional account in production, accepting the full requested permission set.
- Rehearse real original-video publication and verify the actual destination result. Verify real Instagram insights on an older Reel; a dash means unavailable, not a successful insights demonstration.
- Rehearse the dedicated Meta reviewer Yapper login using the credentials already saved in Meta; do not store the password here.
- Rehearse YouTube Disconnect/reconnect in production. Confirm the connected library disappears, the original uploaded source remains in Uploads, and Google asks for authorization again. The warning explains that revocation can also affect website Google sign-in in the same project. Lifecycle unit/integration tests do not replace this live check. [YouTube developer policies, III.D.3](https://developers.google.com/youtube/terms/developer-policies)
- Attach actual review videos, submit the Google and Meta reviews, resolve feedback, then activate approved access. Neither provider's approval is implied by saved form progress.

Facebook remains paused and unattended scheduling remains out of scope for these demos.

## October 23 production release verification

PR #307 merged as `65a85797dbc0d8834b9c48a44c58c0137e7c8375`. Vercel deployment `dpl_EMe9PQKFaMfhZDReHq64SU5p375b` is READY on ypr.app and studio.ypr.app. Required web CI (lint, formatting, typecheck, complete test suite and build) and PostgreSQL integration passed. No schema migration or new environment variable was needed; production CRON_SECRET and provider credentials already exist.

The initial maintenance pass used the merged implementation against the shared production database after verifying the YouTube client and encrypted credentials. It checked/refreshed two valid grants, removed one invalid/inactive connection, pruned 24 old/orphan publish metadata rows, and reported zero failures and no backlog. The existing daily cron continues the lifecycle. This operation did not delete original source files or user-authored captions/notes.

Dev sign-in used the designated development account. Connections, Poster and Brain loaded. Connected warning and unavailable-insights components were visually checked at 390px and 1280px using a temporary local-only fixture removed before commit. Production's owner-established QA session remained signed in. The recording instructions now match the live Uploads tab and Add video file picker. Real provider connection/publication and the reviewer login are still owner rehearsal gates, not claimed as verified by these technical checks.
