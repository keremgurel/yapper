# Publishing rollout — October 15, 2026

## Current gates

This is a readiness ledger, not a claim of successful live posting. The provider consoles were inspected on October 15. No YouTube or Instagram review recordings exist yet, and a complete authenticated publish demonstration remains to be performed.

| Platform  | Verified state                                                                                                                                                                                                                                                                  | Remaining work                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube   | Google project `yapper-502200`: branding verified. `youtube.upload` and `youtube.readonly` unverified. Scope justification already saved. Web and current native source include visibility, audience and synthetic-media controls.                                              | Record the real authorization/read/upload flow, verify the result in YouTube Studio, provide a working unlisted demo link, submit scope verification, and resolve Google's feedback.                                                              |
| Instagram | Meta app `1608889560955742` unpublished; App Review not submitted. Connected OCX Software Inc. business portfolio is verified. Privacy URL and app category present. All three permission descriptions are saved; publishing and insights API-test requirements show Completed. | Record permission demonstrations, complete allowed-usage acknowledgements, fill the missing service-provider list and review prefilled data-handling answers, then verify reviewer access instructions; submit review and publish after approval. |
| TikTok    | Production app approved; corrected client secret and fresh consent now save the connection.                                                                                                                                                                                     | Direct Post audit remains under review. App approval alone does not establish audited public Direct Post availability.                                                                                                                            |
| Facebook  | Paused in the product.                                                                                                                                                                                                                                                          | No review or recording work needed until explicitly re-enabled.                                                                                                                                                                                   |

The [Google review summary](https://console.cloud.google.com/auth/verification?project=yapper-502200) explicitly blocks confirmation because the demo video is missing. The [Meta review draft](https://developers.facebook.com/apps/1608889560955742/app-review/submissions/) asks for screencasts for all three Instagram permissions, and shows the publishing and insights API-test requirements as Completed. The data-handling form says service providers have access, but its provider list is empty; that list and the prefilled organization declarations need review. The Facebook Page permissions and public_profile were removed from the review draft; only instagram_business_basic, instagram_business_content_publish and instagram_business_manage_insights remain. The underlying Facebook app use case and credentials were preserved. No provider review was submitted in this change.

## Review evidence to produce next

Use the prepared [YouTube script](platform-review-recordings/youtube.md), [Instagram script](platform-review-recordings/instagram.md) and [sample preparation](platform-review-recordings/00-setup.md). Each recording should show real consent, the connected identity, data read by the requested permissions, the reviewed post settings, the final publish action, the actual destination result, and disconnect. Use an original clip selected by the owner. An Instagram demo publishes a real Reel; an unlisted YouTube test upload also creates a real video.

For YouTube, cover all active OAuth clients assigned to the project. Verify the actual visibility in Studio. The [current upload reference](https://developers.google.com/youtube/v3/docs/videos/insert) says unverified API projects are not automatically restricted to private viewing. OAuth scope verification and a requested compliance/quota audit are separate processes.

For Instagram, demonstrate a professional account and a real, non-fallback insights value. The integration uses Instagram Login directly; it does not require a Facebook Page. The permission explanations can use this accurate scope:

- `instagram_business_basic`: identify the connected professional account and show its own media library, including video captions and thumbnails, so the creator can choose source content.
- `instagram_business_content_publish`: publish the creator's selected original video as a Reel only after they review the account and caption and confirm publishing in Poster.
- `instagram_business_manage_insights`: show view metrics for the connected account's media in Poster and Home so the creator can review performance.

Do not certify successful tests, invent screencast links, or complete organizational data-handling answers without evidence. The Meta console's allowed-usage acknowledgements and final submission still need the owner's review.

## Facebook pause and reversal

`src/lib/publish/availability.ts` controls the active web/server platform list. Native `PublishPlatform.enabledCases` mirrors it. Facebook credentials, provider code, database enum values, stored tokens, historical posts and disconnect API remain intact.

The pause removes Facebook from Connections, Home, source and destination pickers, caption generation and cross-post defaults. The connections API filters it for older clients. Direct OAuth URLs/callbacks, Page reads/selection, video-library reads, new publish requests and schedule creation cannot activate it. Existing Facebook schedule executions use the same guarded publisher and fail with `platform_paused` instead of sending a new post. Posts already sent can still be reconciled without starting a new publication.

To resume, add Facebook to both active lists, run the rollout/regression tests, and separately complete provider review and a real Page publishing test. Merely having environment credentials does not re-enable it.

## Scheduled cross-posting

Manual posting code and scheduled automation readiness are separate. The deployment inspected during this work does not have `STUDIO_SCHEDULER_ENABLED` set. `vercel.json` only registers the daily storage lifecycle cron, not the publishing worker. A suitable worker trigger, configured secrets and a successful scheduled delivery/recovery test are still required before calling unattended cross-posting production-ready. No hosting upgrade or scheduler activation is included here.
