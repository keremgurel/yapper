# Publishing rollout — October 22, 2026

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

PR #303 added Google grant/channel validation, passed CI and deployed successfully on October 22. Its post-deploy signed-in test is pending the owner's sign-in as `the.ypr.app+clerk_test@gmail.com`, as required by `docs/testing.md`. Local signed-in navigation and invalid-state rejection passed; full-grant and incomplete-grant callback paths passed automated tests. These checks do not establish successful real provider posting.
