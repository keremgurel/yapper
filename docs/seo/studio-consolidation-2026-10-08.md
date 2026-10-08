# Studio site consolidation — October 8, 2026

This supersedes the dual-product homepage and pricing direction in the October 1 matrix. Ypr.app sells Studio; the existing blogs and coaching URLs remain usable until coaching has its own domain.

## Positioning and search intent

The promise is **everything you need to create content in one place**, built around the creator’s voice. The homepage explains one-click cleanup, Brain and Ideas in Lab, natural teleprompter recording, and cross-posting with Poster. The creator’s outcome leads the visible copy; specific search terms live naturally in page titles, descriptions, feature explanations and internal links. No guaranteed editing latency, cut length, audience growth or ranking claims.

| Page                                | Primary intent                          | Supporting terms and reason                                                                                                            |
| ----------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                 | Yapper Studio / content creation studio | All-in-one content creation; talking-head video workflow. Brand and conversion hub, not a forecast of rankings for the broad category. |
| `/pricing`                          | Yapper Studio pricing                   | Monthly/yearly membership, trial, credits. One purchase destination.                                                                   |
| `/features/transcript-video-editor` | text-based video editing                | One-click video editing, remove silences and retakes, transcript video editor for Mac. Prioritize this focused use case.               |
| `/features/ai-script-writer`        | AI video script generator               | Scripts for Reels, Shorts and TikTok based on the creator’s own ideas. Prioritize this over generic screenplay-writing intent.         |
| `/features/teleprompter-recorder`   | teleprompter recorder                   | Record with a script or talking points; talking-head videos. Do not imply a free public tool or available mobile app.                  |
| `/features/idea-capture`            | content ideas for creators              | Brain, previous videos, voice, references and ideas you can shoot. No claim that social connection alone imports all history.          |
| `/features/automatic-captions`      | video caption generator                 | Timed subtitles and captions for short-form video, not social post copy.                                                               |
| `/features/social-publishing`       | cross-post and schedule videos          | Multiple connected channels, per-platform captions and thumbnails. Do not compete on the generic scheduler term as the primary target. |
| `/features/content-calendar`        | content calendar for video              | A schedule connected to work in progress.                                                                                              |
| `/features/content-library`         | content library for video projects      | Ideas, scripts, takes and publishing status together.                                                                                  |

## Evidence and limits

Fresh Search Console pull: `sc-domain:ypr.app`, web search, finalized data only, all countries, **September 8–October 5, 2026** (28 days). Page limit 250; query/page limit 1,000. Raw responses are kept locally in `docs/seo/research-2026-10-08/private/` (gitignored); only the aggregates below are published. Query rows hide anonymized searches; returned-row sums are not property totals.

- `/blog/1-minute-speech-topics`: 100 clicks, 3,593 impressions, average position 8.28.
- `/`: 34 clicks, 1,979 impressions, average position 6.58.
- Studio feature pages returned 10 impressions in total and no clicks. No visible query/page rows for these pages. Positions on so few impressions do not establish ranking strength.
- Blogs are the existing search asset. Their slugs, article content, metadata, canonicals and links to working practice tools remain intact. Blog discovery stays in the public header and footer.

Demand evidence uses the [October 1 research](research-2026-10-01/README.md), not invented fresh volume estimates. DataForSEO US English estimates: text based video editing 50/month, KD 5; AI video script generator 210/month, KD 18; video script generator 390/month, KD 21. Broad video creation software was 1,600/month, KD 70; teleprompter app 8,100/month, KD 59. These are provider estimates, not ranking probabilities, and overlapping variants must not be summed.

October 8 search checks found dedicated text-editing product pages from [VEED](https://www.veed.io/tools/text-based-video-editing), [Clipo](https://www.clipo.pro/features/text-based-editing) and [Captionrich](https://captionrich.com/use-cases/talking-head); [Teleprompter Recorder’s Mac listing](https://apps.apple.com/us/app/teleprompter-recorder/id1545828569?mt=12); and [Copy Machine’s video script generator](https://www.trycopymachine.ai/tools/video-script-generator). Inference: these specific product intents fit Studio, but the SERPs contain competitors. This was a qualitative search check, not a controlled location-specific ranking report. No new Semrush difficulty scores or Content Optimizer scores were obtained.

## Migration safeguards

- `/products/studio` → `/` and `/products/studio/pricing` → `/pricing`: permanent redirects, preserving query parameters.
- Old `/studio` marketing link goes straight to `/`; application-host and editor deep-link rules retain priority.
- Internal Studio links point to the final URLs, including billing return paths and feature breadcrumbs.
- Root and pricing metadata are self-canonical; SoftwareApplication references resolve to the homepage entity. No fabricated review ratings or FAQ rich-result markup.
- Redirected URLs leave the sitemap registry. Blogs and legacy coaching content remain indexable; do not redirect unrelated speaking queries to Studio.
- Existing weekly subscriptions remain recognizable for renewals and storage; new checkout only offers monthly and yearly.

## What to measure next

After Google recrawls, compare equivalent complete 28-day Search Console windows: clicks/impressions by blog URL, homepage query mix, and each feature page’s actual queries. Watch topic-generator traffic separately: the homepage historically ranked for that intent, and changing it to Studio carries a real transition risk. Preserve those relevant blog/tool destinations rather than forcing visitors through a mismatched Studio page. Prioritize feature improvements based on emerging impressions and qualified trial starts; do not add thin keyword pages or promise a rank.
