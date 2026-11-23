# Yapper topical authority plan

22 November 2026. All dates are Pacific. Search Console figures use finalized data only. The latest finalized day in this pull is **20 November 2026**.

Windows used throughout:

| Window | Dates | Site clicks | Site impressions | Avg pos | CTR |
|---|---|---:|---:|---:|---:|
| Last 28 days | 24 Oct–20 Nov 2026 | 162 | 13,073 | 12.8 | 1.24% |
| Previous 28 days | 26 Sep–23 Oct 2026 | 201 | 10,738 | 8.4 | 1.87% |
| Last 90 days | 23 Aug–20 Nov 2026 | 494 | 29,528 | 11.2 | 1.67% |

Yapper is no longer a speech-improvement product. ypr.app is a creator studio: an AI script writer, a teleprompter, a transcript-based video editor, captions and publishing. Speech-practice topics belong to [speakingpractice.ai](https://speakingpractice.ai). Several practice *tools* already 301 there (9 October 2026). Two overlapping impromptu *posts* already 301 to the SpeakingPractice.ai guide (22 November 2026). This plan is about the rest of the site: what to publish so Google treats ypr.app as a studio, and what to recommend for the legacy practice posts that still bring most of the clicks.

**This document is a plan.** It does not redirect, delete or noindex anything. Those actions need an explicit go-ahead, and should be logged in the [experiment ledger](experiments/README.md) if they ship.

Keyword volumes and difficulties are DataForSEO US English estimates from the [October 2026 research](keyword-research-2026-10.md) plus a small 22 November gap pull (cost $0.016). Do not add close variants together.

## 1. Homepage drop

The last-28 vs previous-28 comparison that started this work: `https://ypr.app/` went from **36 clicks / 2,442 impressions / position 6.2** to **4 clicks / 674 impressions / position 9.5**.

### What changed on the page

The title, meta and promise changed on **8 October 2026** in commit `7431cc85` (“Make Yapper Studio the main site and simplify pricing”). They have been stable since.

| | Before (2 Oct, dual-product homepage) | After (8 Oct–today) |
|---|---|---|
| Title | Yapper: speaking practice and a video studio | Yapper Studio: your all-in-one content creation studio |
| Meta | Yapper makes two separate products: Yapper Train for speaking practice and Yapper Studio for making and publishing video. | Everything you need to create content in one place. Ideas that sound like you, a teleprompter, one-click video editing and cross-posting. Try Yapper Studio. |
| H1 / lede | Speaking practice and a video studio, as two products | “Everything you need to create content.” Ideas, teleprompter, one-click editing and posting. |

The visible content also changed: Train was removed, practice URLs started 301ing to speakingpractice.ai on 9 October, and the homepage became a Studio walkthrough (one-click edit, Brain/Ideas, teleprompter, Poster). Later November commits refined layout and the closing CTA; they did not change the title or the promise.

The [8 October consolidation note](../../../docs/seo/studio-consolidation-2026-10-08.md) already flagged the risk: the homepage had been earning topic-generator and practice-adjacent discovery, and turning it into a Studio page would drop mismatched traffic before studio queries arrived.

### What it ranked for

Query-level Search Console rows are incomplete (privacy filtering: the previous 28 days show 36 page-level clicks but only 5 clicks in the query list). The queries that *are* visible are almost all brand and navigational, not “teleprompter” or “script writer”:

| Query | Prev 28 days (impr / pos) | Last 28 days (impr / pos) |
|---|---|---|
| yapper.website | 467 / 6.1 | 8 / 8.9 |
| yapper website | 338 / 5.5 | 49 / 9.0 |
| yapper | 392 / 5.7 | 46 / 8.5 |
| yapper app | 55 / 8.0 | 7 / 9.9 |
| yapper.web | 28 / 4.9 | 14 / 7.6 |

Two things happened at once:

1. **The page no longer matches speaking-practice intent**, which is what we wanted. Those queries should not be recovered on the homepage.
2. **Brand queries also faded and slipped in position.** “yapper.website” looks like leftover demand for an older domain, so some of that decline is natural. “yapper” and “yapper website” falling in both impressions and position is the part to watch: the new title leads with “Yapper Studio” and a category promise, and the page is not yet winning impressions for studio terms that would replace the lost brand clicks.

Weekly clicks on the homepage (finalized, week starting Monday):

| Week of | Clicks | Impressions |
|---|---:|---:|
| 28 Sep | 12 | 530 |
| 5 Oct (title changed 8 Oct) | 11 | 223 |
| 12 Oct | 7 | 1,310 |
| 19 Oct | 5 | 255 |
| 26 Oct | 0 | 121 |
| 2 Nov | 1 | 96 |
| 9 Nov | 1 | 129 |
| 16 Nov | 2 | 264 |

The previous 28-day window still includes about two weeks of the old homepage, so 36 → 4 slightly overstates a clean before/after. The weekly series still shows a real break after 8 October: clicks held through that week, then fell to 0–2 a week from 26 October, and they have not recovered.

The homepage is not “broken.” It is early in a repositioning, and it is not yet a ranking page for the studio topics the rest of this plan is meant to build. Treat it as a brand and conversion hub. Do not retarget it at speech-practice queries. Do give it a chance to rank for brand-plus-studio terms (“Yapper Studio,” “Yapper teleprompter,” “Yapper script writer”) by using those phrases naturally and by earning supporting documents that link to it.

## 2. The 1-minute speech topics drop

`/blog/1-minute-speech-topics` went from **106 clicks / 4,951 impressions / position 7.9 / CTR 2.14%** to **75 clicks / 4,642 impressions / position 8.3 / CTR 1.62%** in those same 28-day windows. Over 90 days it still has 246 clicks and 12,174 impressions. It is the site’s number one URL by a wide margin.

The title, excerpt and body did not change in this period, except for a 22 November internal-link edit in the impromptu 301 commit (`49b305de`). This is not a content regression.

Weekly clicks were 16–19 through mid-September, **spiked to 43 the week of 28 September**, then settled back to 12–21. The previous 28-day window includes that spike week; the last 28 days look like the normal run rate, plus a modest CTR and position softening. Some individual queries lost a few clicks (“talk about a random topic for 1 minute,” “speaking on a random topic for 1 minute”); nothing in the query list looks like a collapsed ranking.

**Recommendation: keep the page.** A 301 to SpeakingPractice.ai would give away about 75 clicks per 28 days, which is nearly half of ypr.app’s current search clicks. SpeakingPractice.ai does have a 1-minute speech topics URL, but this post is still Yapper’s strongest search asset. If we ever move it, do it as a logged experiment, after a period of tying it more clearly to “short talking-head takes,” and only with an explicit go-ahead. Not now.

## 3. Audit of indexable pages

Indexable URLs are the sitemap set: the public route registry in `src/lib/seo/public-routes.json` plus current `content/blog` posts (29 posts; the two impromptu posts were already removed and 301’d). Studio app routes (`/studio/...`) are disallowed in robots.txt and are not in the sitemap. Hash-fragment search rows for the 1-minute post are the same page, not extra URLs.

Classification:

- **Core** — a studio page, or a post already aimed at scripting, teleprompter, talking-head video or content ideas.
- **Adjacent** — useful to creators, but still written as speech practice (openings, filler words, speaking pace, presentation practice). A rewrite can pull these onto the studio map.
- **Legacy** — speech-practice topic lists, timers and drills. These still produce most of the clicks.
- **Brand** — privacy and terms.
- **Already redirected** — listed only when they still appear in Search Console.

Clicks and impressions below are the last 28 days and last 90 days, for the canonical URL only (fragment rows are omitted so impressions are not double-counted).

### Core

| URL | 28d clicks | 28d impr | 90d clicks | 90d impr | Notes |
|---|---:|---:|---:|---:|---|
| `/` | 4 | 674 | 84 | 4,925 | See §1. 90-day clicks are mostly from before 8 October. |
| `/pricing` | 2 | 209 | 2 | 387 | |
| `/features` | 1 | 91 | 1 | 115 | Hub. Thin as a ranking page. |
| `/features/ai-script-writer` | 1 | 115 | 1 | 128 | |
| `/features/teleprompter-recorder` | 1 | 56 | 3 | 71 | Best of the feature pages, still tiny. |
| `/features/transcript-video-editor` | 0 | low / none in the page list | 0 | — | The differentiator. Almost no search presence. |
| `/features/automatic-captions` | 0 | 14 | 0 | 42 | |
| `/features/idea-capture` | 0 | 25 | 0 | 34 | |
| `/features/social-publishing` | 0 | 12 | 0 | 18 | |
| `/features/content-calendar` | 0 | 24 | 0 | 24 | |
| `/features/content-library` | 0 | 17 | 0 | 23 | |
| `/blog` | 0 | 14 | 0 | 42 | |
| `/blog/what-is-a-teleprompter` | 0 | 587 | 0 | 587 | Visibility without clicks. CTR problem. |
| `/blog/how-to-memorize-a-script` | 0 | 326 | 0 | 326 | Same pattern. Average position looks better than the primary query (which has not landed yet). |
| `/blog/how-to-write-a-video-script` | 1 | 26 | 1 | 26 | |
| `/blog/tiktok-script` | 0 | 54 | 0 | 54 | |
| `/blog/video-script-examples` | 0 | 50 | 0 | 50 | |
| `/blog/youtube-script` | — | — | — | — | Shipped 22 November; no finalized post-change data yet. |
| `/blog/talking-head-video` | 0 | 14 | 0 | 14 | |
| `/blog/how-to-generate-content-ideas` | 0 | 44 | 0 | 50 | |

Core studio URLs earned about **10 clicks** in the last 28 days. The new posts are being seen (especially the teleprompter and memorize posts) but almost nobody is clicking. Fixing those titles and internal links is cheaper than writing around them.

### Adjacent

| URL | 28d clicks | 28d impr | 90d clicks | Recommendation |
|---|---:|---:|---:|---|
| `/blog/presentation-practice` | 2 | 100 | 5 | Rewrite toward rehearsing a talking-head or course video, then recording it in Studio. Keep until that rewrite ships. |
| `/blog/how-to-start-a-speech` | 1 | 341 | 1 | Rewrite toward video openings / hooks. 341 impressions already. |
| `/blog/words-per-minute-speaking` | 1 | 25 | 1 | Rewrite toward script length and on-camera pace. Link the new calculator in §5. The `/tools/words-per-minute` *tool* already 301s to SpeakingPractice.ai; this post can stay as a studio-facing guide. |
| `/blog/what-are-filler-words` | 0 | 8 | 0 | Rewrite toward removing filler words in a transcript edit, or later 301 to the SpeakingPractice.ai filler-words guide. Traffic is negligible. |
| `/blog/filler-words-examples` | 0 | 297 | 0 | Same family. Impressions without clicks. Rewrite toward “filler words that show up on camera, and how the editor cuts them,” or keep only one of the three filler posts and point the others at it. |
| `/blog/overcome-filler-words` | 0 | 32 | 0 | Same recommendation as the other filler posts. |

### Legacy speech-practice posts

These 15 still-indexable posts (plus two already-redirected slugs that still show residual Search Console rows) are why the site still has clicks, and why Google can still read ypr.app as a speaking-practice site.

| URL | 28d clicks | 28d impr | Prev 28d clicks | 90d clicks | Recommendation |
|---|---:|---:|---:|---:|---|
| `/blog/1-minute-speech-topics` | 75 | 4,642 | 106 | 246 | **Keep.** See §2. Optionally add a short “if you are filming a 60-second talking-head, here is the studio workflow” link. Do not 301. |
| `/blog/good-speech-topics` | 18 | 1,575 | 2 | 22 | **Keep for now.** It grew in the last 28 days. A later rewrite can tilt the list toward “topics that make a good talking-head video” without throwing away the current queries. |
| `/blog/random-topic-generator` | 9 | 426 | 24 | 41 | **Keep for now, plan a later 301** to SpeakingPractice.ai’s random-topic / impromptu experience. The *tool* URL `/random-topic-generator` already 301s there; this post is leftover article intent and is already declining (24 → 9). Revisit after the 1-minute page decision is settled. |
| `/blog/speech-topic-ideas-for-practice` | 8 | 782 | 8 | 20 | **Keep.** Stable. Treat like good-speech-topics: a later creator-angled rewrite is possible; a 301 is not justified at 8 clicks. |
| `/blog/topics-to-talk-about-speaking-practice` | 7 | 337 | 2 | 9 | **Keep.** Slightly up. Same family as the other topic lists. |
| `/blog/random-topic-generator-with-timer` | 5 | 221 | 0 | 5 | **Keep for now.** Close overlap with the other random-topic post and with SpeakingPractice.ai. Prefer consolidating onto one article later, then considering a 301 of the weaker one. |
| `/blog/public-speaking-practice-exercises` | 2 | 87 | 0 | 3 | **Keep, low priority.** Eventual 301 to a SpeakingPractice.ai drills / practice page is reasonable; traffic is small. |
| `/blog/impromptu-speaking-topics-timer` | 1 | 51 | 0 | 1 | **Recommend a later 301** to `https://speakingpractice.ai/guides/impromptu-speaking`, the same destination as the two posts already redirected. Not in this change. |
| `/blog/practice-public-speaking-online-free` | 1 | 5 | 0 | 1 | **Recommend a later 301** to SpeakingPractice.ai (the product this title now describes). |
| `/blog/table-topics-questions` | 1 | 162 | 0 | 1 | **Recommend a later 301** to `https://speakingpractice.ai/guides/toastmasters-table-topics`. |
| `/blog/fluency-practice-drills` | 0 | 16 | 0 | 0 | **Recommend a later 301** to SpeakingPractice.ai. No meaningful traffic. |
| `/blog/how-to-practice-public-speaking-alone` | 0 | 4 | 0 | 0 | **Recommend a later 301** to SpeakingPractice.ai. |
| `/blog/how-to-think-faster-when-speaking` | 0 | 66 | 0 | 0 | **Recommend a later 301** to SpeakingPractice.ai, or a rewrite only if we can honestly make it about on-camera first takes. Prefer 301. |
| `/blog/speaking-under-pressure` | 0 | 5 | 0 | 0 | **Recommend a later 301** to SpeakingPractice.ai. |
| `/blog/what-to-do-when-your-mind-goes-blank` | 0 | 66 | 0 | 0 | **Recommend a later 301** to SpeakingPractice.ai. |
| `/blog/impromptu-speaking-practice` | 1 | 55 | 2 | 4 | **Already 301’d** (22 Nov) to the SpeakingPractice.ai impromptu guide. Residual Search Console rows should fade. Check coverage at the 6 December redirect review. |
| `/blog/impromptu-speaking-frameworks` | 0 | 40 | 0 | 0 | **Already 301’d.** Same review. |

Roughly **128 of the last 162 site clicks** still come from legacy practice posts (75 of them from a single URL). Core studio URLs contributed about 10. Until the studio cluster earns its own clicks, we should not donate the high-traffic legacy URLs.

Brand pages `/terms` (17 clicks / 977 impressions) and `/privacy` (2 / 491) are incidental navigational results. Leave them alone.

## 4. Topic map

Five pillars, each with a product page, supporting posts and (where honest) a free tool. Volumes are US monthly DataForSEO estimates for a *representative* head term, not a sum of variants.

### Scripting

**Pillar:** `/features/ai-script-writer` (strengthen the title and body around “AI video script generator” / “video script writer”).

Already shipped: `/blog/how-to-write-a-video-script`, `/blog/video-script-examples`, `/blog/tiktok-script`, `/blog/youtube-script`.

| Topic | Representative volume | KD | Notes |
|---|---:|---:|---|
| video script / script for a video | 3,600 | 27–41 | Head term is competitive; the how-to and template posts are the right angle. |
| youtube script / youtube video script | already targeted by the 22 Nov post | — | Let this post mature before writing another YouTube how-to. |
| tiktok script / tiktok script generator | 880 for the generator term, KD 6 | already covered | |
| instagram reel script | 10–30 | 0 | Still worth a short “Reels script” sibling so the cluster covers YouTube, TikTok and Reels. |
| podcast script / how to write a podcast script | 1,000 / 390 | 0 | Honest fit if Studio scripts can be used for a podcast recording. |
| hook ideas (video-specific) | 3,600 for the head term, KD 11–14 | high | The generic SERP is full of essay hooks. A *video* hook page, or a hook generator tool, is the only honest play. 590/mo for “hook generator,” KD 0. |

**Product-led:** a **script word-count-to-video-length calculator** (see §5). “Video length calculator” is only 50/mo, but the tool is the linkable asset that the YouTube, TikTok and Reels posts can all point to, and it uses a number we already publish (words per minute).

### Teleprompter

**Pillar:** `/features/teleprompter-recorder`. The product is a **teleprompter for Mac**, not a free in-browser teleprompter and not a mobile app. The 8 October note already warned against implying either. Do not build a fake “free online teleprompter” just because that query is 3,600/mo (KD 33) or “teleprompter online” is 6,600 (KD 34).

| Topic | Representative volume | KD | Notes |
|---|---:|---:|---|
| teleprompter app / apps | 8,100 | 59 | Hard head term. The feature page will not win this soon. Support it with more specific pages. |
| teleprompter for mac / mac teleprompter | 1,000 / 1,000 | 24 / 32 | Honest, winnable, product-true. Put this language on the feature page and in a dedicated “teleprompter for Mac” use-case write-up. |
| how to read a teleprompter | 30 | 0 | Small volume, perfect supporting article (eye contact, sounding natural). “Teleprompter eye contact” is 10/mo. |
| what is a teleprompter | already covered | — | 587 impressions, 0 clicks in 28 days. Improve the title and the first-screen answer before writing a second definition post. |

**Product-led:** do not ship a free web teleprompter if the product cannot actually do that. A public “try the teleprompter in the browser” page is worth it *only if* Studio can run a real prompt-and-record flow there. If it cannot, keep the feature page as the product URL and write the how-to.

### Video editing (transcript, silences, filler, jump cuts)

**Pillar:** `/features/transcript-video-editor`. This is the product’s sharpest contrast with a generic caption app, and it barely appears in Search Console.

Search volume is smaller than teleprompter or scripts, and that is fine: intent is high and the page can be original.

| Topic | Representative volume | KD | Notes |
|---|---:|---:|---|
| text-based / text based video editing | 50 | 5 | Feature-page primary. |
| remove silence from video / remove silences from video | 40 / 40 | 0 / 1 | Strong supporting post. |
| remove filler words from video | 10 | 0 | Ties the leftover filler-word articles to the editor. |
| auto jump cut | 10 | — | Mention in the silences post; not a standalone page yet. |

**Product-led:** the feature page itself, plus one definitive “edit a talking-head video by the transcript” guide with a screen-level walk-through (silence, filler, retakes, jump cuts, captions). That guide is one of the first three pieces in §8.

### Captions and subtitles

**Pillar:** `/features/automatic-captions`.

| Topic | Representative volume | KD | Notes |
|---|---:|---:|---|
| automatic captions / auto captions | 2,400 / 2,400 | 51 / 51 | Competitive. Feature page + a how-to is enough at first. |
| youtube captions | 1,000 | 10 | More specific, better first post than “auto captions” alone. |
| how to add captions to a video | 1,300 | 31 | How-to sibling. |

Stay on *timed captions on the video*, not social-post copy, as the 8 October note says.

### Creator workflow

**Pillar:** a combination of `/features/idea-capture`, `/features/content-calendar`, `/features/social-publishing`, and `/blog/talking-head-video`.

| Topic | Representative volume | KD | Notes |
|---|---:|---:|---|
| talking head video / what is a talking head video | 390 / 260 | 0 | Already covered; still almost no impressions. Give it links from the new editor and teleprompter posts. |
| content ideas | 880 | 1 | Supporting the idea-capture page; a post already exists. |
| batch filming / content batching / batch content creation | 20 / 40 / 30 | 0 | Small but uniquely close to Studio’s “idea → script → record → edit → post” loop. One workflow post is enough. |
| cross post | 1,000 | 12 | Easy to wander into Facebook/Instagram howto territory. Keep it on “post the same talking-head to several channels from Studio.” |

### Competitor and alternative pages

Only write these where a comparison can be honest.

| Topic | Representative volume | KD | Honest angle |
|---|---:|---:|---|
| capcut alternative | 1,900 | 0 | Possible, if we are clear: CapCut is a general short-form timeline editor; Yapper is a talking-head studio (script, teleprompter, transcript edit, captions, publish). Not “we do everything CapCut does.” |
| descript alternative | 210 | 0 | Closer product-to-product (transcript editing). Worth a careful comparison once the editor guide exists. |
| riverside alternative | 210 | 0 | Recording-and-edit overlap. Only if we can describe what Yapper does and does not do. |
| veed alternative | 50 | 0 | Lower priority. |
| bigvu alternative | 20 | 0 | Teleprompter-plus-recording overlap, small demand. A paragraph on the teleprompter feature page is enough at first. |
| teleprompter.com alternative | no volume in the 22 Nov pull | — | Skip as a standalone page until demand shows up in Search Console or a later keyword pull. |

Do not build a thin “X alternative” series for the sake of the list. CapCut and Descript are the only two that deserve a full page in the next quarter.

## 5. First product-led pages

1. **Script length calculator** (`/tools/script-length` or similar). Input a word count or paste a script, output estimated runtime at 130 / 150 / 160 wpm, with presets for a 15s Reel, a 60s TikTok or YouTube Short, and an 8–15 minute YouTube video. This is honest: we already use those rates in the script posts. It should noindex nothing, live in the sitemap, and be linked from every script article and from `/features/ai-script-writer`.
2. **Teleprompter for Mac / how to read a teleprompter naturally.** Prefer strengthening `/features/teleprompter-recorder` for the “teleprompter for Mac” query, plus a guide on reading naturally and keeping eye contact. A public web teleprompter only if the product actually runs in the browser.
3. **Hook helper, later.** “Hook generator” is 590/mo, KD 0, and it is a natural free tool — but only if the output is *video* hooks (first 3–8 seconds of a talking-head), not essay hooks. Build it after the calculator and the editor guide, when we can feed it from Ideas or Brain without inventing a toy.

## 6. Internal linking

- **Up, from posts to pillars.** Every script post already should link to `/features/ai-script-writer` and to the calculator, once it exists. Every teleprompter or talking-head post links to `/features/teleprompter-recorder`. The editor guide links to `/features/transcript-video-editor` and `/features/automatic-captions`.
- **Sideways, inside a cluster.** YouTube, TikTok, Reels and the generic video-script post link to each other once, not in a stack of identical footers. The talking-head post is the join between teleprompter and editor.
- **Down, from pillars and the homepage.** `/features` and the homepage should name and link the calculator and the editor guide as soon as they are live. Do not turn the homepage back into a blog index.
- **Do not feed the old topic.** New studio posts should not link out to the legacy topic-list and drills posts just to “use up” internal links. The exception is a single, deliberate sentence on a *kept* legacy page (“If you are filming this as a talking-head, here is the studio workflow”).
- **Across sites, carefully.** When a later 301 is approved, the destination should already be a strong SpeakingPractice.ai page. Do not cross-link every leftover drills post to SpeakingPractice.ai from the Yapper homepage; that confuses both sites.

## 7. What not to do

- Do not redirect, delete or noindex any of the high-traffic legacy posts in the next cycle (`1-minute-speech-topics`, `good-speech-topics`, the speech-topic-idea posts, the random-topic posts).
- Do not retitle the homepage back toward speaking practice.
- Do not publish a “free online teleprompter” that the product cannot honor.
- Do not chase faceless-Reels queries (large volume, tagged low-fit in the October research; the product is built around a person talking on camera).
- Do not write a second “what is a teleprompter” or a second YouTube-script how-to until the ones we have start earning clicks.

## 8. Publishing order (12 weeks)

The Sunday routine can follow this list, one studio-true piece a week. Swap the order if Search Console starts showing a clearly missed query, but do not slip back into speech-practice topics.

| Week | Ship | Why this, now |
|---|---|---|
| 1 | **Script length calculator** (tool page) | Linkable asset for every script post we already have. First of the three opening pieces. |
| 2 | **How to read a teleprompter naturally** (eye contact, not sounding scripted), and a pass on `/features/teleprompter-recorder` for “teleprompter for Mac” | Supports the product page; helps the 587-impression definition post by giving people a next step. |
| 3 | **Edit a talking-head by the transcript** (remove silences, filler and retakes; jump cuts; then captions) | The differentiator. Third opening piece. Also gives the leftover filler-word posts a studio place to point. |
| 4 | Title/meta and internal-link pass on `/blog/what-is-a-teleprompter` and `/blog/how-to-memorize-a-script` | They already have impressions and zero clicks. Cheaper than a new URL. Log it as `title_meta` in the experiment ledger. |
| 5 | **How to write an Instagram Reels script** | Closes the YouTube / TikTok / Reels set. |
| 6 | **Video hooks that work in the first 8 seconds** (talking-head and Shorts, not essay hooks) | High demand if the angle stays on video. |
| 7 | **YouTube captions: add timed subtitles from your transcript** | Builds the captions cluster off a specific, lower-KD term. |
| 8 | **Batch a week of talking-head videos** (idea → script → record → edit → post) | The workflow post that only Studio can tell honestly. |
| 9 | **How to write a podcast script** (and record it on camera or off) | 1,000/mo, KD 0, adjacent to the script cluster. |
| 10 | **Descript alternative** (honest comparison) | Closest product analogue. Write it after the editor guide exists. |
| 11 | **CapCut alternative for talking-head videos** (honest comparison) | Larger demand; only after we can say clearly what we are not. |
| 12 | Rewrite `/blog/how-to-start-a-speech` toward video openings, **or** a hook-helper tool if week 6 confirmed demand | Closes the loop on an adjacent post that already has 341 impressions. |

After this cycle, look at the experiment ledger and the scorecard before starting another 12 weeks. The next candidates are a hook generator (if we can keep it on video hooks), a CapCut/Descript follow-up only if those pages earn impressions, and — separately, with an explicit go-ahead — the first low-traffic legacy 301s in §3 (table topics, leftover impromptu timer, “practice public speaking online free,” zero-click drills).

### The first three pieces to build

1. The script length calculator.
2. The “read a teleprompter naturally” guide, with a Mac-specific pass on the feature page.
3. The transcript-editing talking-head guide.

Log each one with `log_change.py --push` on the day it goes live. The calculator is a `tool_page` (read at 4 weeks, judge at 12). The guides are `new_post`. The teleprompter feature-page pass is `title_meta` or `content_refresh`.

## 9. How we will know it is working

- Weekly [scorecard](experiments/reports/): studio / feature / new-post share of clicks should rise; the site-wide average position should stop sliding. Legacy clicks may stay large for a long time, and that is all right.
- Each shipped piece gets a baseline in the [ledger](experiments/README.md). Do not judge a new post before 12 weeks, or a title change before 8.
- Homepage: watch brand queries (“yapper,” “yapper studio,” “yapper teleprompter”) separately from leftover “yapper.website” decay. Success is not “get back to 36 clicks.” Success is a small, growing set of studio-plus-brand clicks and no return to practice intent.
- `/blog/1-minute-speech-topics`: keep an eye on it in the scorecard. If it falls hard *after* we add a studio sidebar, treat that as a warning, not a reason to 301.
