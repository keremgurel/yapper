# Yapper topical authority plan

First written 22 November 2026. Revised 23 November 2026 to match product direction from Can. All dates are Pacific. Search Console figures use finalized data only. The latest finalized day in the GSC pull is **20 November 2026**.

Windows used throughout (unchanged from the 22 November audit):

| Window | Dates | Site clicks | Site impressions | Avg pos | CTR |
|---|---|---:|---:|---:|---:|
| Last 28 days | 24 Oct–20 Nov 2026 | 162 | 13,073 | 12.8 | 1.24% |
| Previous 28 days | 26 Sep–23 Oct 2026 | 201 | 10,738 | 8.4 | 1.87% |
| Last 90 days | 23 Aug–20 Nov 2026 | 494 | 29,528 | 11.2 | 1.67% |

Yapper is everything you need to talk to the camera and post. The product is a creator studio for “yapping” — talking-head videos that feel natural and authentic. They should not be heavily scripted or over-edited, but they still need structure so the point makes sense and the story lands.

The workflow the site should teach, and that the product already follows: capture an idea fast (voice, text, or a pasted inspiration link that Yapper transcribes when it can), combine your own thoughts with that inspiration, let AI turn it into a script you can edit, record with the teleprompter if you want, one-click edit to cut silences, retakes and other trims, then cross-post. Speech-practice topics belong to [speakingpractice.ai](https://speakingpractice.ai). Several practice *tools* already 301 there (9 October 2026). Two overlapping impromptu *posts* already 301 to the SpeakingPractice.ai guide (22 November 2026).

**This document is a plan.** It does not redirect, delete or noindex anything, and it does not change any live page. Those actions need an explicit go-ahead, and should be logged in the [experiment ledger](experiments/README.md) if they ship.

The homepage-drop diagnosis, the 1-minute speech topics note, the page audit and the legacy-page recommendations in §§1–3 are unchanged from 22 November. What changed in this revision is the topic map, the platform language (do not position Yapper as Mac-only), a framework library, a competitor map (including the product Can remembered as “Cut.ai / use.ai”), and a new 12-week publishing order.

Keyword volumes and difficulties are DataForSEO US English estimates from the [October 2026 research](keyword-research-2026-10.md), a small 22 November gap pull ($0.016), and a 23 November overview of 84 keywords ($0.022). Do not add close variants together. Head terms like “STAR method” (60,500) and “teleprompter” (40,500) are listed with a warning when the SERP is not about yapping videos.

## 0. What the product actually ships today

Use this section as a brake on the plan. Do not claim a feature in a post, title or comparison page unless it is true on this date, or clearly marked as coming.

**Available now**

- **Web:** capture ideas (voice, text, or a reference link), keep the source with the idea, shape hooks and scripts in Brain / the AI script writer, and publish or schedule to supported social accounts.
- **Inspiration links:** paste a YouTube, TikTok or Instagram video. Yapper pulls title, thumbnail, and a transcript when one is available, then you can add your own thoughts and turn the mix into a script. Not every link yields a transcript; write “when a transcript is available,” not “every video is transcribed.”
- **Hook patterns already in the product:** Contrarian claim, Stop doing X, Stakes first, Mid-action cold open, Specific-number proof, POV framing, Named enemy, Curiosity gap with a payoff, Credential flash, Direct-address callout. These can back a public framework library. Named formats such as STAR, PAS, AIDA, PREP and Hook-Story-Lesson are *not* shipped as named templates yet. Framework pages can still send people into the script writer; only claim a “Yapper template” where one actually exists.
- **Mac app:** record with a scrolling teleprompter, then one-click and transcript-based editing (silences, retakes, word-level cuts), captions, and export. This is where recording and editing live today.
- **Cross-posting (Poster):** YouTube, TikTok and Instagram are enabled. Instagram needs a Professional (Business or Creator) account. Facebook is in the product but **paused**. Do not say Yapper posts to every platform, and do not name Facebook as a live destination until it is re-enabled.
- **AI assistance:** Brain and Chirpy help capture ideas and structure scripts. Script generation uses Studio credits.

**Coming, or not available yet**

- **Mobile app:** coming soon. The aim is the same feature set as desktop, kept very simple. The marketing site already says: scan a code to pick up on your phone, record with a teleprompter, and edit in the mobile app. A scan-to-phone handoff exists in the codebase, but the app is not launched. Do not write as if an iPhone or Android app is available. Prepare a launch-ready landing page and ship it when the app is actually out.
- **Windows:** not available yet. Say so if a comparison or feature page is asked.
- **Browser-only recorder or editor:** not being offered on the feature pages today. Ideas and scripts work on the web; recording and the one-click editor ship in the Mac app.
- **A free public teleprompter:** no. Do not build or advertise a fake “free online teleprompter” just because that query is large (1,900/mo, KD 38; earlier research also saw 3,600–6,600 on close variants).

**Platform language for every new page**

Yapper is web and desktop now, and a mobile app is coming. Do **not** position the product as Mac-only or desktop-only. Mention Mac only on pages that are genuinely about the current Mac recorder or editor (for example a “teleprompter for Mac” use-case page). Feature-page titles and cluster posts should talk about talking to the camera, on the platforms Yapper supports — not “a teleprompter for Mac” as the brand promise.

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

Eight pillars, following the actual workflow. Each has a product page or a planned hub, supporting posts, and (where honest) a tool or a comparison. Volumes are US monthly DataForSEO estimates for a *representative* head term, not a sum of variants.

### 4.1 Structure and storytelling for yapping videos

**Pillar post (to write):** “How to structure a talking-head video” — also the place we define yapping in plain language: one idea, spoken to camera, structured enough to follow, loose enough to sound like a person.

“Talking head video” is 1,000/mo at KD 0. “What is a talking head video” is 260/0; a post already exists and has almost no impressions, so improve it and point it at this pillar rather than writing a second definition. The phrases Can keeps hearing — “how to structure a yapping video,” “how to structure a talking-head video” — barely register in keyword tools (often no volume at all). That does not make the pillar a bad idea. It means we win the topic by covering the formats people already search for (hooks, scripts, story frameworks) and by being the clear guide Google can attach to “talking head video.”

“How to write a video script” is 3,600/13 and we already have `/blog/how-to-write-a-video-script`. Refresh and link it here; do not start over. YouTube and TikTok script posts already exist; let them mature and point them at this pillar.

### 4.2 Talking to the camera

**Pillar post (to write):** “How to talk to the camera naturally.”

Search volume is small (“how to talk to the camera” 50/7, “how to speak on camera” 50/0, “how to look natural on camera” 10/39) but this is the delivery promise of the product, and it is what creators are already watching on TikTok and Instagram. The page should teach eye contact, sounding like yourself, talking from an outline rather than a wall of text, and using a teleprompter only as a net — not as a reason to perform a written essay. Link the teleprompter feature page as optional, never required.

### 4.3 Idea capture and inspiration-to-script

**Pillar:** `/features/idea-capture`, plus a product-led post: “Turn an inspiration video into your own script.”

“Content ideas” is 1,000/0. “Video ideas” is 3,600/12 (broad). “How to come up with content ideas” is only 20/0, but the job is real: people forget ideas, then stare at a blank camera. Yapper’s honest angle is narrower and stronger than a generic idea generator: capture a thought by voice or text, paste a link to a video that sparked it, keep your notes beside the transcript, and turn that mix into a script you can still rewrite.

### 4.4 Scripting

**Pillar:** `/features/ai-script-writer`. Strengthen the page around “structure for your point, room for your voice” — not “an essay the teleprompter will read.”

Already shipped: `/blog/how-to-write-a-video-script`, `/blog/video-script-examples`, `/blog/tiktok-script`, `/blog/youtube-script`. “AI script writer” is 1,000/25; “AI video script generator” is 210/18; “podcast script” is 1,000/0. A short Reels-script sibling is still worth a later week so the cluster covers YouTube, TikTok and Reels. Do not write a second YouTube-script or TikTok-script post until the ones we have start earning clicks.

### 4.5 Teleprompter (every platform Yapper supports)

**Pillar:** `/features/teleprompter-recorder`. Rewrite the *plan* for this page’s language: it is a teleprompter for talking-head videos, available in the Mac app today, on the web for the script, and in a mobile app when that ships. Do not title new cluster posts “teleprompter for Mac” unless the page is specifically about Mac.

Volumes: “teleprompter” 40,500/KD 50 (too broad to win soon); “teleprompter app” 8,100/60 (same); “teleprompter app iphone” 2,400/36 (save for the mobile launch); “teleprompter for Mac” 1,000/24 (a fair *specific* page, because that is what ships today); “how to read a teleprompter” 30/0; “best teleprompter app” 720/36 (only honest once mobile exists, or if the page is clearly a comparison that admits iPhone is coming). `/blog/what-is-a-teleprompter` already has 587 impressions and 0 clicks — fix the title and the first-screen answer before writing another definition post.

### 4.6 One-click editing, without over-editing

**Pillar:** `/features/transcript-video-editor`. This is the product’s sharpest contrast with stylized “AI editors” that add zooms, stock B-roll and sound effects. The yapping brief is the opposite: cut silences, retakes and the trims that get in the way, then stop. Leave the ums that still sound like a person if they should stay.

“Jump cuts” is 6,600/5, but much of that SERP is film language, not a talking-head cleanup. A clearly scoped “jump cuts in a talking-head video” guide can work; do not chase the Godard query. “Remove silences from video” and “remove filler words from video” are tiny (40 and 10). The page earns its keep as the product story and as the place leftover filler-word posts can point after a rewrite, not as a volume play.

### 4.7 Captions

**Pillar:** `/features/automatic-captions`. “Automatic captions” / “auto captions” are 2,400/51 — competitive. “YouTube captions” is 1,000/10 and “how to add captions to a video” is 1,300/31, better first supporting posts. Stay on timed captions on the talking-head video, not social-post copy.

### 4.8 Cross-posting and creator workflow

**Pillar:** `/features/social-publishing`, with `/features/content-calendar` and `/blog/talking-head-video` in support.

“Cross post” is 1,900/21 but often navigational or generic. Keep the post on “post the same talking-head to YouTube, TikTok and Instagram from Studio.” Name only destinations that are live. Batching and “never lose an idea” belong here as workflow pieces. `/blog/talking-head-video` already exists and has almost no impressions — give it links from the new structure, teleprompter and editor posts.

## 5. Framework library

A public library of the formats creators actually teach for talking-head and yapping videos. One URL per format, each explaining the beats in plain language, showing a short worked example, and linking to the structure pillar and to a Yapper hook pattern or script-writer flow where one exists. This is good programmatic depth without inventing thin pages: every format has to be a real method people already use.

Research for this list came from public articles, YouTube guides (including “The Art of Yapping” and similar talking-to-camera videos), Reddit script-structure threads, and write-ups of TikTok/Instagram yapping and storytime formats. The names below are the ones that keep showing up. Search volume is often on the *method name*, not on “yapping framework,” and some names (especially STAR and AIDA) are used far beyond short video. Each page must say it is about a talking-head video, or we will wander into interview-prep and generic copywriting SERPs.

### The core yapping shapes (write these first)

| Format | Beats, as people teach them | Volume / KD | Notes |
|---|---|---|---|
| Hook → one idea → evidence → ask | A claim in the first two seconds, one point, a number or story, one instruction or comment prompt. | Covered by “talking head video” 1,000/0 and hook terms | The default yap. Creatorflow and similar guides describe this almost word for word. |
| Hook-Story-Lesson | Hook, a short story, the point the viewer can use. | “hook story lesson” had no tool volume | Closest named match to what Can described. Build it anyway; it is the spine of a lot of yapping advice. |
| Storytime beats | Open inside the action, stakes, turn, payoff, lesson. | Long-tail | How TikTok/Instagram storytime guides tell people to talk. No “so, storytime” opener. |
| Hook, story, two points | Hook, anecdote, point, point. | Long-tail | From talking-on-camera / “art of yapping” videos. |
| Steelman, then the point | Hook, name the opposite argument, answer it, then your reason. | Long-tail | Sometimes taught as an “Eight Mile” structure. Good for strong takes. |
| Strong take / small epiphany / storytime | Three *styles*, not one beat sheet. | Long-tail | A useful companion page so people pick a mode before a framework. |

### Named methods people already search for

| Format | Beats | Volume / KD | Honest use on ypr.app |
|---|---|---|---|
| PAS (Problem-Agitate-Solve) | Name the problem, make the cost felt, then the way through. | PAS 90/1; “problem agitate solve” 50/10 | Natural for “stop doing this on camera” videos. Low volume, still worth a library URL. |
| Hook-Story-Offer | Hook, story, the thing you are offering. | 30/0 | Only when the video actually has an offer. Easy to turn into a sales script; keep it optional. |
| AIDA | Attention, Interest, Desire, Action. | 2,400/31 | Real demand, mixed SERP (marketing courses). The page has to be “AIDA for a talking-head video,” or skip it until we can win that angle. |
| Before-After-Bridge | Life before, life after, the bridge that got you there. | 20/7 | Simple transformation yaps. |
| PREP | Point, Reason, Example, Point. | 320/19 | Built for speaking, not ads. A very clean fit for a 30–60 second yap. |
| STAR | Situation, Task, Action, Result. | “STAR method” 60,500/50 | Almost all of that volume is job interviews. Do **not** chase the interview SERP. A short “use STAR to tell a story on camera” page is still useful, titled so interview-hunters are not the target. |
| SCQA | Situation, Complication, Question, Answer. | 480/5 | Winnable. Good for explainers and “here is the decision I made” yaps. |
| Pixar Story Spine | Once upon a time… and every day… until one day… | 210/0 | A friendly storytime template. Keep it short. |
| Problem-Solution-Proof-CTA | UGC-style product or opinion yap. | Long-tail | Honest when the video is a recommendation. |
| Myth-bust / contrarian | Name the belief, why it fails, what to do instead. | Maps to the product’s “Contrarian claim” hook | Already a hook pattern in Studio. |
| Listicle / countdown | Numbered tips. | Broad | Use sparingly. Empty “top three tips” videos are what the yapping guides tell people *not* to lean on. One library page is enough. |

**Do not build first-wave pages for** the Hero’s Journey or StoryBrand. They are too heavy for a natural 30–60 second yap and they pull us into brand-storytelling courses.

Each library URL should end with: here is how to capture the idea in Yapper, here is the hook pattern to start from (if one maps), and here is the script writer if you want a draft — then record it in your own words. If a named template does not exist yet, say so and link the script writer anyway.

## 6. Product-led tools and launch pages

Build only tools the product can actually power.

1. **Script word-count-to-video-length calculator.** Still a good, honest free tool. It uses a number we already publish (words per minute) and gives every script post something to link to. “Video length calculator” is small; the value is the linkable asset.
2. **Video hook generator**, only if it stays on *video* hooks (first eight seconds of a talking-head), not essay hooks. “Hook generator” is 590/0; “hook ideas” is 3,600/14, but the generic SERP is full of writing hooks. Can wait until after the first three pieces.
3. **Inspiration-to-script** is already a product flow, not a separate widget. The post in §4.3 is the public door.
4. **Mobile app landing page, launch-ready but unpublished until the app ships.** Target “teleprompter app iphone” (2,400/36) and “best teleprompter app” only when a creator can actually download it. The page should promise the same workflow as desktop, kept simple — not a cut-down companion. Do not imply Android or iPhone availability before each one is real.
5. **“Teleprompter for Mac”** remains a fair specific page for the app that ships today. It is not the brand position.

## 7. Competitors, and what Can meant by “Cut.ai / use.ai”

The product Can was reaching for is almost certainly **[CutAI](https://usecutai.com/)** (often written Cut AI or Cut.ai). The website is **usecutai.com**, which is easy to remember as “use CutAI,” and easy to shorten out loud to “use.ai.” It is an iPhone and iPad editor (iOS 17+) that auto-cuts pauses, retakes and filler, adds captions, and lets you refine the cut on a timeline. It does not capture ideas, transcribe inspiration links, write a script, or run a teleprompter-to-cross-post studio. It is not on Android, and it is not a desktop workflow.

Two near-misses, so we do not mix them up later:

- **[use.ai](https://use.ai)** is an AI chat workspace (many models in one subscription). It is not a video product.
- **[Cutora](https://usecutora.com/)** is a *web* talking-head editor that makes a first cut of pauses, false starts and retakes. The URL is also a “use + cut…” name. If the memory was “a talking-head cut tool on the web,” this could have been it. Treat CutAI as the primary match; keep Cutora in the competitive set for auto-cut.

### Overlap by workflow step

| Step | Closest products | Do they really overlap? |
|---|---|---|
| Idea capture | Notes apps, ChatGPT, a few creator “idea” tools | Weak overlap. Yapper’s version is voice or text, kept with the idea, organized by pillar. |
| Inspiration link → transcript → your notes → script | Almost no direct rival in the set below | Distinctive. Opus Clip transcribes long videos to *clip* them, not to help you write your own yap. |
| Scripting / structure | ChatGPT, Captions’ script tools, generic script generators | Overlap on “draft some words.” Yapper’s angle is structure from *your* idea and references, meant to be edited into something you would say. |
| Teleprompter | BigVu, Teleprompter.com, Captions | Real overlap on prompting. Those tools do not do the rest of the studio. BigVu is a well-known branded query (5,400, KD 80) — a hard alternative page. |
| Auto-cut silences / retakes | **CutAI**, Cutora, Descript, Captions, Submagic, PopScript, Toast | Real overlap. This is the comparison set for the editor. |
| Captions | Captions, Submagic, CapCut, Descript | Real overlap. Captions (the app) is the namesake and a serious talking-head product (teleprompter, captions, AI edit, phone-first). |
| Cross-posting | Later, Buffer, Publer, the in-app share sheets | Overlap only at the last mile. Yapper’s point is that posting sits on the same project as the idea and the cut. |
| General short-form timeline | CapCut | Only honest as “talking-head studio vs general editor.” CapCut is not an idea-to-script tool. |
| Long video → many shorts | Opus Clip (90,500, branded) | Weak overlap. Do not write an “Opus Clip alternative” unless the product actually turns long recordings into many clips, which it does not today. |

**When to write comparison pages.** Only where we can be honest about platforms and features.

- **CutAI alternative** — a good page once we can say clearly: CutAI is a strong iPhone auto-cut; Yapper is the full talk-to-camera workflow, with auto-cut on the Mac app today and a mobile app coming. Publishing that page *before* mobile ships is possible if the difference is the workflow, not “we are also an iPhone editor.”
- **Captions alternative** — later. Captions is phone-first, stylized, and includes tricks (eye-contact correction, AI twins, heavy AI edit) that sit badly with “don’t over-edit.” The honest contrast is natural talking-head studio vs. a effects-heavy talking-head app.
- **Descript alternative** — 210/0, fair later. Descript is the transcript-editor incumbent, heavier on podcasts and long form.
- **CapCut alternative** — 1,900/0, larger demand; only after we can say what we are not (no general timeline effects suite).
- **Submagic** — 6,600 branded. Auto-cut plus captions plus a lot of decoration. A comparison is only useful if we argue for *less* editing, not feature parity.
- **BigVu / Teleprompter.com** — teleprompter overlap only. Low priority until the mobile app exists.

## 8. Internal linking

- Every new framework page links up to the structure pillar and sideways to one or two sibling formats, not to the whole library.
- Structure, talking-to-camera, and inspiration-to-script posts all link to `/features/ai-script-writer` and `/features/idea-capture`.
- Talking-to-camera and “how to read a teleprompter” link to `/features/teleprompter-recorder`. Use all-platform language; add a Mac-only sentence only in a Mac-specific article.
- Edit-without-over-editing, filler-word rewrites, and jump-cut (talking-head) posts link to `/features/transcript-video-editor`.
- Captions how-tos link to `/features/automatic-captions`.
- Workflow and batching posts link to `/features/social-publishing` and the calendar. Name YouTube, TikTok and Instagram only.
- New studio posts link to `/` as the product home, not as a speech-practice page.
- Existing script posts (YouTube, TikTok, how-to-write, examples, talking-head) should gain a short paragraph pointing at the structure pillar and, when it exists, the calculator.
- Legacy topic-list posts that we **keep** can add one quiet line for people who arrived to film a short talking-head, pointing at the structure pillar or the inspiration flow. Do not retarget those posts away from the queries they already win.

## 9. What not to do

- Do not retarget the homepage at speech-practice queries.
- Do not 301, noindex or delete legacy posts in this change. See §3.
- Do not position Yapper as Mac-only, and do not claim the mobile app, a Windows app, or a free online teleprompter before they exist.
- Do not start a thin “alternatives” series. One honest comparison at a time, after we have supporting guides.
- Do not chase faceless Reels, AI-avatar, or Opus-style long-to-shorts queries the product does not serve.
- Do not write a second teleprompter-definition, YouTube-script, or TikTok-script post until the ones we have get clicks.
- Do not title a page “STAR method” as if we were an interview-prep site.

## 10. Publishing order (12 weeks)

A Sunday-routine sequence. Swap only if a review or a launch date (especially mobile) forces it. Log each ship in the [experiment ledger](experiments/README.md).

| Week | Piece | Why this week |
|---|---|---|
| 1 | **How to structure a talking-head video** (the yapping structure pillar) | The flagship educational page. Defines the topic, introduces the framework library, and gives every later format a parent. |
| 2 | **How to talk to the camera naturally** | The delivery promise. Ties structure to sounding like yourself, and mentions the teleprompter as optional. |
| 3 | **Turn an inspiration video into your own script** | The distinctive product story we can tell honestly today, on the web: paste a link, add your thoughts, leave with a draft. |
| 4 | Title/meta and internal-link pass on `/blog/what-is-a-teleprompter`, `/blog/how-to-memorize-a-script`, and `/blog/talking-head-video`. Publish the **framework library hub** (index, not 12 thin posts). | Impressions without clicks is cheaper to fix than a new URL. Log the title work as `title_meta`. |
| 5 | **PREP for talking-head videos** (first named framework page) | Best combination of speaking fit and reachable volume (320/19) in the library. Link it to the script writer. |
| 6 | **Hook-story-lesson** (and a short “video hooks in the first 8 seconds” section or sibling) | The format Can described, plus hook demand (3,600/14 if we stay on *video* hooks). |
| 7 | **Never lose a content idea** (voice, note, or a pasted link) | Supports idea-capture. “Content ideas” is 1,000/0. |
| 8 | **Edit a talking-head without over-editing** (one-click cut of silences and retakes; what to leave in) | The editor differentiator, and a home for later filler-word rewrites. |
| 9 | **SCQA for short videos**, and a carefully titled **STAR on camera** page (not interview STAR) | Two library pages. SCQA is the more winnable named term (480/5). |
| 10 | **Storytime structure** (open in the action, stakes, turn, payoff, lesson) | Completes the storytelling cluster. |
| 11 | **Script length calculator** (tool) and a pass that links it from the script posts | Linkable asset for the cluster. |
| 12 | **YouTube captions / how to add captions to a talking-head**, *or* finalize the **mobile app landing** and hold it until launch day | Captions if the app is not ready; the landing page if a ship date is real. A CutAI or CapCut comparison only if we can be honest that week. |

After this cycle, read the experiment ledger and the scorecard before starting another 12 weeks. Next candidates: PAS and AIDA-for-video library pages, a hook generator if we can keep it on video hooks, a Reels-script sibling, a Mac-specific teleprompter page, the mobile landing going live, and — separately, with an explicit go-ahead — the first low-traffic legacy 301s in §3.

## 11. The first three pieces to build

1. The talking-head / yapping structure pillar.
2. How to talk to the camera naturally.
3. Turn an inspiration video into your own script.

Drafts still come back for a look before title or meta changes on existing URLs. New posts follow the usual Sunday routine.

## 12. How we will know it is working

Same waiting rules as the [experiment ledger](experiments/README.md): a first read at four weeks, a judgment at twelve for new posts, and no verdict on thin impression counts.

- Weekly [scorecard](experiments/reports/): studio, feature and new-post share of clicks should rise. Legacy clicks may stay large for a long time, and that is all right.
- The structure pillar and the inspiration-to-script post should pick up impressions for talking-head, script and content-idea queries, not for speech-practice leftovers.
- Framework pages are judged as a cluster, not as twelve isolated bets. If a named method only attracts the wrong intent (interviews, generic marketing), retitle or narrow it; do not pad the library.
- The homepage is a brand and conversion hub. Watch brand queries and studio-term impressions; do not use speech-practice clicks as its KPI.
