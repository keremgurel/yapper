# Yapper (ypr.app) keyword research — US, October 2026

Prepared 2026-10-24 for Can Gurel. Data: DataForSEO Labs (US, English, location 2840), Google Search Console for `sc-domain:ypr.app` (28 and 90 days to 2026-10-22), live Google SERPs checked 2026-10-24, plus Reddit, X and Quora searches. Dataset: [`keywords-2026-10.json`](./keywords-2026-10.json). Posts written from this research are tracked in the [blog post log](./blog-post-log.md); keywords a post targets are marked **covered** below and carry a `covered` value in the JSON.

## How to use this when writing content

1. Pick a topic from [Prioritized post topics](#prioritized-post-topics) that is not marked covered and is not in the speakingpractice.ai overlap list.
2. Look up the primary and secondary keywords in the JSON (`vol`, `kd`, `variantGroup`). Keywords with the same `variantGroup` are Google Ads close variants that share one volume figure: target the group once and do not add their volumes together.
3. Search the keyword on Google, read the top pages and write something more useful for a solo creator (see [SERP notes](#serp-spot-checks-2026-10-24)).
4. Add a row to the [blog post log](./blog-post-log.md) and set `covered` on the keywords here.

## Field reference

| Field                       | Meaning                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kw`                        | Keyword (US English)                                                                                                                                          |
| `cluster` / `fit`           | Topic cluster and product fit: `high` (Studio does this), `medium` (adjacent), `low` (wrong intent or product we don't make), `overlap (speakingpractice.ai)` |
| `vol`                       | Google Ads monthly search volume, US                                                                                                                          |
| `kd` / `kdEst`              | DataForSEO keyword difficulty 0–100. `kdEst: true` means DataForSEO returned none; 25 is assumed for `opp`                                                    |
| `cpc`                       | Google Ads CPC, USD                                                                                                                                           |
| `intent`                    | DataForSEO main search intent                                                                                                                                 |
| `trend`                     | Year-over-year volume change, %                                                                                                                               |
| `question`                  | Keyword is phrased as a question                                                                                                                              |
| `variantGroup`              | Rows sharing volume, CPC and trend in one cluster (close variants)                                                                                            |
| `pos` / `url` / `gscImpr90` | Average GSC position, ranking URL and impressions over 90 days, when ypr.app has impressions for that exact query                                             |
| `opp`                       | `vol × (100 − KD) / 100`                                                                                                                                      |
| `covered`                   | Post that targets the keyword, with date                                                                                                                      |

The JSON keeps the 1,564 rows with volume ≥ 30, a GSC position or a covered marker. Cluster totals below are computed on the full classified set of 3,453 keywords.

## What Yapper is now

Yapper Studio is a creator workflow for people who talk to camera: capture ideas (Brain), an AI video script writer that compares hooks and drafts an editable script or talking points, a teleprompter recorder in the native Mac app, a transcript-based video editor that removes silences and repeated attempts, automatic captions with a personal dictionary, a content library, a content calendar and social publishing. Membership includes a 7-day trial; AI generation uses Studio credits and recording does not. Mobile is coming soon; Windows is not available (`src/data/feature-details.ts`).

The audience is solo creators, educators, coaches and founders making Reels, Shorts, TikToks and YouTube explainers, mostly on a Mac.

The speaking practice product (Train) moved to speakingpractice.ai on 2026-10-09. `/training`, `/random-topic-generator`, `/freestyle`, `/progress` and `/tools/words-per-minute` already 301 to speakingpractice.ai (`next.config.ts`). The speech-topic blog posts are still on ypr.app.

## Headline findings

1. **All of Yapper's non-brand search traffic is speaking-practice traffic.** In the last 90 days ypr.app had 810 clicks and 40,140 impressions. `/blog/1-minute-speech-topics` alone had 466 clicks and 14,723 impressions (plus ~10,000 more on its `#section` URLs). Every striking-distance query is a speech-topic or random-topic query. No creator-workflow query (script, teleprompter, captions, hooks, editing) has more than 20 impressions.
2. **DataForSEO ranked keywords agree.** 73 US and 16 India keywords rank for ypr.app; all are speech topics, 1-minute speeches or words per minute, mostly at positions 20–90. India is where the 1-minute topic page ranks best (positions 18–45 for 1,600-volume terms).
3. **The creator clusters are large and easy.** "How to write a video script" (2,900/mo, KD 1, +440% YoY) and its variants, "video script template" (590, KD 0), "hook ideas" (3,600, KD 11), "content ideas" (880, KD 1), "capcut alternative" (1,900, KD 0) and "talking head video" (390, KD 0) all have weak first pages: generic corporate guides, screenplay-format articles, forums and old posts.
4. **Teleprompter is the biggest cluster but mostly hardware and apps.** "Teleprompter" and close variants are 40,500/mo; "teleprompter app" 8,100 (KD 59) and "teleprompter for mac" 1,000 (KD 55) are competitive. Informational teleprompter terms ("what is a teleprompter" 2,400, KD 0; "how teleprompter works" 720, KD 0) are easy but far from purchase. "Teleprompter app for mac" (720, KD 19) is the realistic product target.
5. **Brand CTR is a problem.** "yapper" (1,384 impressions, position 6.4, 0.3% CTR), "yapper.website" (462) and "yapper website" (331) rank below other products named Yapper. This is a homepage title/brand issue, not a blog topic.
6. **Quick CTR fix (note only, not changed):** `/blog/1-minute-speech-topics` sits at position 7.9 over 28 days with 2.3% CTR. A title and description that match "random topics to talk about for 1 minute" would likely lift clicks. Whether the page stays on ypr.app or moves to speakingpractice.ai is Can's decision; nothing was moved or redirected.

## speakingpractice.ai overlap

speakingpractice.ai's October 2026 research plans posts on: articulate, filler words, reading out loud, public speaking exercises alone, speech topic lists, words per minute and IELTS speaking. Yapper should not publish on those. Yapper currently ranks for several of them through older posts (`/blog/1-minute-speech-topics`, `/blog/random-topic-generator`, `/blog/speech-topic-ideas-for-practice`, `/blog/good-speech-topics`, `/blog/what-are-filler-words`, `/blog/words-per-minute-speaking`, `/blog/public-speaking-practice-exercises`). Those keywords are tagged `overlap (speakingpractice.ai)` in the JSON and are excluded from the topic list. The two sites will compete for these queries until Can decides which domain owns them.

## Cluster summary

| Cluster                                                | Fit                           | Keywords | Total vol | Vol (variants deduped) | Avg KD | Opp (deduped) |
| ------------------------------------------------------ | ----------------------------- | -------: | --------: | ---------------------: | -----: | ------------: |
| Teleprompter                                           | high                          |      495 |   302,590 |                149,660 |   24.4 |       113,373 |
| Video scripts & templates                              | high                          |      480 |   120,000 |                 46,090 |   11.8 |        38,641 |
| Faceless content                                       | low                           |       20 |    67,140 |                 38,140 |   18.7 |        32,984 |
| Content calendar & planning                            | medium                        |      229 |    64,940 |                 27,140 |   22.8 |        20,176 |
| Speech topics & random topic generator (SP.ai overlap) | overlap (speakingpractice.ai) |      400 |    38,530 |                 20,000 |    8.4 |        19,578 |
| Captions & subtitles                                   | high                          |      392 |    39,240 |                 24,500 |   17.2 |        18,845 |
| Transcript extraction (wrong intent)                   | low                           |       35 |    25,470 |                 19,120 |   28.5 |        11,720 |
| Content ideas                                          | high                          |      367 |    13,460 |                  9,110 |    8.2 |         8,742 |
| Short-form video (general)                             | medium                        |      203 |    19,310 |                  9,020 |   14.8 |         7,747 |
| AI script writer & generators                          | high                          |      129 |     8,270 |                  7,450 |   12.0 |         6,321 |
| Hooks                                                  | high                          |      181 |    11,140 |                  5,870 |   10.4 |         5,284 |
| Competitor alternatives                                | medium                        |      110 |     5,450 |                  4,690 |    5.0 |         4,636 |
| Cross-posting & scheduling                             | high                          |       87 |     5,480 |                  4,220 |   10.1 |         3,844 |
| Talking to camera & on-camera confidence               | high                          |      276 |     4,560 |                  2,890 |   11.5 |         2,801 |
| Silence & filler removal / text-based editing          | high                          |       49 |       560 |                    240 |   13.4 |           218 |

Faceless content and transcript extraction have volume but the wrong intent for Yapper (Yapper is for people who appear on camera, and "get the script from a YouTube video" wants an extractor).

## What already ranks (GSC, pages)

| Page                                                                          | Clicks 90d | Impr 90d |  CTR |  Pos | Clicks 28d | Impr 28d | Pos 28d |
| ----------------------------------------------------------------------------- | ---------: | -------: | ---: | ---: | ---------: | -------: | ------: |
| /blog/1-minute-speech-topics                                                  |        466 |   14,723 | 3.2% |  9.6 |        109 |     4776 |     7.9 |
| /                                                                             |        239 |    8,712 | 2.7% |  7.5 |         36 |     2489 |     6.2 |
| /blog/1-minute-speech-topics#25-easy-1-minute-speech-topics                   |          1 |    2,250 | 0.0% |  8.6 |          0 |      612 |     8.3 |
| /blog/1-minute-speech-topics#25-2-minute-speech-topics                        |          0 |    2,242 | 0.0% |  8.6 |          0 |      610 |     8.3 |
| /blog/1-minute-speech-topics#how-to-practice-a-1-minute-speech                |          0 |    2,003 | 0.0% |  8.7 |          0 |      531 |     8.4 |
| /blog/1-minute-speech-topics#25-opinion-based-speech-topics                   |          0 |    1,249 | 0.0% |  8.7 |          0 |      304 |     8.4 |
| /blog/speech-topic-ideas-for-practice                                         |         15 |    1,238 | 1.2% | 21.0 |          7 |      812 |    16.8 |
| /blog/random-topic-generator                                                  |         42 |    1,196 | 3.5% | 12.6 |         23 |      708 |    11.2 |
| /blog/1-minute-speech-topics#the-fastest-structure-for-a-1-minute-answer      |          1 |    1,158 | 0.1% |  8.6 |          0 |      296 |     8.2 |
| /blog/1-minute-speech-topics#how-to-make-random-speech-topics-more-useful     |          0 |    1,116 | 0.0% |  8.7 |          0 |      265 |     8.4 |
| /blog/good-speech-topics                                                      |          4 |      660 | 0.6% | 21.0 |          3 |      307 |     8.9 |
| /tools/words-per-minute                                                       |          0 |      659 | 0.0% | 47.6 |          0 |       43 |     8.9 |
| /terms                                                                        |          7 |      436 | 1.6% |  5.1 |          7 |      358 |     3.8 |
| /privacy                                                                      |          6 |      426 | 1.4% |  8.7 |          6 |      345 |     7.0 |
| /blog/presentation-practice                                                   |          4 |      319 | 1.3% | 16.6 |          1 |      149 |     7.6 |
| /blog/public-speaking-practice-exercises                                      |          1 |      223 | 0.4% | 19.4 |          0 |       16 |     6.0 |
| /blog/words-per-minute-speaking                                               |          0 |      183 | 0.0% | 24.1 |          0 |       82 |     6.5 |
| /pricing                                                                      |          0 |      168 | 0.0% |  7.0 |          0 |      162 |     7.0 |
| /blog/impromptu-speaking-practice                                             |          8 |      131 | 6.1% |  8.8 |          2 |       33 |     6.9 |
| /products/studio/pricing                                                      |          1 |      129 | 0.8% |  6.3 |          1 |      129 |     6.3 |
| /blog/how-to-start-a-speech                                                   |          0 |       97 | 0.0% | 11.5 |          0 |       65 |    10.0 |
| /studio                                                                       |          1 |       79 | 1.3% | 12.2 |          1 |       23 |     5.2 |
| /training                                                                     |          6 |       71 | 8.5% |  7.5 |          4 |       48 |     5.6 |
| /blog/practice-public-speaking-online-free                                    |          0 |       49 | 0.0% |  7.2 |          0 |       19 |     7.5 |
| /features                                                                     |          1 |       47 | 2.1% | 20.7 |          0 |       14 |     5.5 |
| /blog                                                                         |          1 |       45 | 2.2% | 13.9 |          0 |       17 |    10.6 |
| /blog/speech-topic-ideas-for-practice#15-story-based-speech-topic-ideas       |          0 |       39 | 0.0% |  6.1 |          0 |       19 |     6.0 |
| /blog/what-are-filler-words                                                   |          0 |       35 | 0.0% | 11.4 |          0 |       18 |    10.6 |
| /blog/speech-topic-ideas-for-practice#15-impromptu-speech-topics-for-pressure |          0 |       34 | 0.0% |  6.3 |          0 |       18 |     5.7 |
| /blog/topics-to-talk-about-speaking-practice                                  |          1 |       33 | 3.0% | 13.8 |          1 |       33 |    13.8 |

Feature pages barely register: `/features/teleprompter-recorder` (19 impressions, position 6.7) and `/features/ai-script-writer` (19, position 16.3) over 90 days. `/blog/how-to-generate-content-ideas` (published 2026-10-09) has 6 impressions at 6.2.

## Striking distance (GSC 90 days, positions 5–20, ≥30 impressions)

| Query                                              | Impr 90d | Clicks |   CTR |  Pos | Pos 28d | Ranking URL                  |
| -------------------------------------------------- | -------: | -----: | ----: | ---: | ------: | ---------------------------- |
| yapper                                             |    1,384 |      4 |  0.3% |  6.4 |     5.9 | /                            |
| random topics to talk about for 1 minute           |      843 |     20 |  2.4% |  8.1 |     7.7 | /blog/1-minute-speech-topics |
| unprompted topic generator                         |      785 |     16 |  2.0% |  7.3 |    22.7 | /                            |
| speaking on a random topic for 1 minute            |      566 |     15 |  2.7% |  8.2 |     7.0 | /blog/1-minute-speech-topics |
| yapper.website                                     |      462 |      1 |  0.2% |  6.1 |     6.1 | /                            |
| yapper website                                     |      331 |      1 |  0.3% |  5.4 |     5.4 | /                            |
| talk about a random topic for 1 minute             |      307 |      6 |  2.0% |  8.4 |     7.8 | /blog/1-minute-speech-topics |
| unprompted random topic generator                  |      211 |      5 |  2.4% |  8.1 |       - | /                            |
| unprompted random topic                            |      169 |      3 |  1.8% |  9.7 |       - | /                            |
| speaking for 1 minute on a random topic            |      141 |      1 |  0.7% |  8.5 |     8.0 | /blog/1-minute-speech-topics |
| random topic for speaking                          |      135 |      3 |  2.2% |  9.3 |     9.2 | /blog/1-minute-speech-topics |
| 1 minute random topic                              |      130 |      5 |  3.8% |  8.1 |     8.1 | /blog/1-minute-speech-topics |
| speak on a random topic for 1 minute               |      126 |      3 |  2.4% |  9.1 |     9.0 | /blog/1-minute-speech-topics |
| random topic to talk about for 1 minute            |      125 |      2 |  1.6% |  8.6 |     7.9 | /blog/1-minute-speech-topics |
| speech topic gen                                   |      115 |      3 |  2.6% | 15.7 |    28.7 | /                            |
| speech topic generator                             |      111 |      5 |  4.5% |  9.5 |     8.0 | /                            |
| talking 1 minute on random topic                   |      111 |      1 |  0.9% |  8.5 |     7.2 | /blog/1-minute-speech-topics |
| random topic generator to talk about 1 minute      |       98 |      3 |  3.1% |  9.6 |     8.9 | /blog/1-minute-speech-topics |
| random topics for 1 minute speech                  |       81 |      4 |  4.9% |  7.1 |     4.8 | /blog/1-minute-speech-topics |
| random topic 1 minute                              |       73 |      2 |  2.7% |  7.8 |     9.5 | /blog/1-minute-speech-topics |
| 1 minute speech topics                             |       68 |      0 |  0.0% | 14.1 |    10.2 | /blog/1-minute-speech-topics |
| talk about random topic for 1 minute               |       65 |      4 |  6.2% |  7.4 |     6.9 | /blog/1-minute-speech-topics |
| one minute random topic                            |       65 |      2 |  3.1% |  8.0 |     8.2 | /blog/1-minute-speech-topics |
| random speech topic generator                      |       63 |      1 |  1.6% |  7.6 |       - | /                            |
| random topic generator for speech                  |       60 |      6 | 10.0% |  9.7 |    22.2 | /                            |
| unprompted random topics                           |       58 |      1 |  1.7% |  9.6 |    10.5 | /blog/1-minute-speech-topics |
| 1 min random topic                                 |       54 |      3 |  5.6% |  9.3 |    10.2 | /blog/1-minute-speech-topics |
| random topic generator for public speaking         |       53 |      2 |  3.8% |  9.6 |    10.6 | /                            |
| random topic generator unprompted                  |       51 |      2 |  3.9% |  8.2 |       - | /                            |
| unprompted one minute speech                       |       50 |      1 |  2.0% |  8.7 |       - | /blog/1-minute-speech-topics |
| random topic generator off the cuff                |       50 |      0 |  0.0% |  9.5 |     9.5 | /blog/random-topic-generator |
| yapper app                                         |       49 |      1 |  2.0% |  7.3 |     7.6 | /                            |
| random topic generator impromptu speaking practice |       49 |      0 |  0.0% |  8.2 |    10.2 | /                            |
| talk about a topic for 1 minute                    |       47 |      1 |  2.1% | 10.6 |    13.6 | /blog/1-minute-speech-topics |
| one minute speech topics                           |       45 |      1 |  2.2% | 14.0 |    12.8 | /blog/1-minute-speech-topics |
| speak for 1 minute on a random topic               |       44 |      0 |  0.0% |  8.6 |     8.3 | /blog/1-minute-speech-topics |
| yapper talk                                        |       44 |      0 |  0.0% |  6.1 |     6.8 | /                            |
| 1 minute talk topics                               |       37 |      4 | 10.8% | 10.5 |     4.4 | /blog/1-minute-speech-topics |
| topics to talk about for 1 minute                  |       34 |      0 |  0.0% |  8.4 |     7.3 | /blog/1-minute-speech-topics |
| random topic generator with timer                  |       32 |      1 |  3.1% |  6.8 |     7.9 | /                            |

Every row is brand or speakingpractice.ai overlap. There is no creator-workflow query in striking distance, so this week's post was chosen from the low-KD creator clusters instead.

## High impressions, low CTR

| Query                                    | Impressions 90d |  CTR | Position | URL                          | Note                                                                               |
| ---------------------------------------- | --------------: | ---: | -------: | ---------------------------- | ---------------------------------------------------------------------------------- |
| yapper                                   |           1,384 | 0.3% |      6.4 | /                            | Brand confusion with other "Yapper" apps; homepage title should say what Yapper is |
| random topics to talk about for 1 minute |             843 | 2.4% |      8.1 | /blog/1-minute-speech-topics | Overlap; title/meta fix if the page stays                                          |
| unprompted topic generator               |             785 | 2.0% |      7.3 | /                            | Overlap; homepage ranks for a tool that now lives on speakingpractice.ai           |
| speaking on a random topic for 1 minute  |             566 | 2.7% |      8.2 | /blog/1-minute-speech-topics | Overlap                                                                            |
| yapper.website / yapper website          |             793 | 0.3% |  5.4–6.1 | /                            | Brand                                                                              |

## Ranking queries with no dedicated page

- "unprompted topic generator" (785 impressions), "unprompted random topic generator", "speech topic generator", "random topic generator with timer" rank with the homepage, which no longer offers a topic generator. The tool is on speakingpractice.ai.
- "yapper ai video", "yapper video", "yapper content" (5–11 impressions each) land on the homepage with no page explaining Yapper Studio for video creators beyond `/studio`.
- No creator query had enough impressions to need a new page.

## Top 40 content quick wins (high fit, KD ≤ 30, variants deduped)

| #   | Keyword                                                           | Cluster                       |    Vol |  KD | CPC $ | Intent        |    YoY |    Opp |
| --- | ----------------------------------------------------------------- | ----------------------------- | -----: | --: | ----: | ------------- | -----: | -----: |
| 1   | autocue teleprompter (+1 variants)                                | Teleprompter                  | 40,500 |   6 |  2.77 | transactional |   -33% | 38,070 |
| 2   | hook ideas (+1 variants)                                          | Hooks                         |  3,600 |  11 |       | informational |    +0% |  3,204 |
| 3   | how do you write a script for a video **(covered)** (+5 variants) | Video scripts & templates     |  2,900 |   0 |  1.58 | informational |  +440% |  2,900 |
| 4   | how to make video script **(covered)**                            | Video scripts & templates     |  2,900 |   1 |  5.73 | informational |  +400% |  2,871 |
| 5   | video script (+6 variants)                                        | Video scripts & templates     |  3,600 |  27 |  3.05 | informational |  +184% |  2,628 |
| 6   | online free teleprompter (+5 variants)                            | Teleprompter                  |  3,600 |  29 |  1.72 | informational |    +0% |  2,556 |
| 7   | elgato teleprompter                                               | Teleprompter                  |  2,400 |   0 |  1.81 | transactional |   -21% |  2,400 |
| 8   | what is a teleprompter                                            | Teleprompter                  |  2,400 |   0 |  2.17 | informational |   +48% |  2,400 |
| 9   | teleprompter glass (+2 variants)                                  | Teleprompter                  |  1,600 |   0 |  2.52 | transactional |    +0% |  1,600 |
| 10  | teleprompter what is (+2 variants)                                | Teleprompter                  |  1,600 |   0 |  1.36 | informational |   -84% |  1,600 |
| 11  | youtube script (+1 variants)                                      | Video scripts & templates     |  1,900 |  18 |  2.23 | informational |    +0% |  1,558 |
| 12  | writing video script **(covered)** (+4 variants)                  | Video scripts & templates     |  1,600 |  12 |  9.51 | informational |  +504% |  1,408 |
| 13  | write video script **(covered)** (+3 variants)                    | Video scripts & templates     |  1,600 |  12 |     4 | informational |  +519% |  1,408 |
| 14  | video script writer                                               | AI script writer & generators |  1,600 |  12 |  9.51 | commercial    |  +504% |  1,408 |
| 15  | bigvu teleprompter app                                            | Teleprompter                  |  1,600 |  17 |  2.51 | navigational  |   -95% |  1,328 |
| 16  | video tutorial script (+1 variants)                               | Video scripts & templates     |  1,300 |   0 |       | informational |  +650% |  1,300 |
| 17  | capcut auto captions                                              | Captions & subtitles          |  1,300 |   8 |  3.73 | transactional |   +22% |  1,196 |
| 18  | tiktok script                                                     | Video scripts & templates     |  1,300 |   9 |   8.8 | informational |   +48% |  1,183 |
| 19  | how to create video script **(covered)** (+3 variants)            | Video scripts & templates     |  1,300 |  13 |  6.34 | informational | +1015% |  1,131 |
| 20  | bigvu teleprompter                                                | Teleprompter                  |  1,300 |  18 |  2.75 | transactional |   -32% |  1,066 |
| 21  | teleprompter cue                                                  | Teleprompter                  |  1,300 |  29 |  3.31 | transactional |   +46% |    923 |
| 22  | how to memorize a script                                          | Video scripts & templates     |    880 |   0 |   0.1 | informational |    +0% |    880 |
| 23  | cross post                                                        | Cross-posting & scheduling    |  1,000 |  12 | 10.04 | navigational  |   +60% |    880 |
| 24  | content ideas                                                     | Content ideas                 |    880 |   1 | 11.31 | informational |    +0% |    871 |
| 25  | tiktok script generator                                           | AI script writer & generators |    880 |   6 |  7.51 | transactional |   -33% |    827 |
| 26  | ai script writer                                                  | AI script writer & generators |  1,000 |  19 |  5.89 | commercial    |   -55% |    810 |
| 27  | auto captions youtube                                             | Captions & subtitles          |  1,000 |  27 |  3.38 | informational |   +81% |    730 |
| 28  | how teleprompter work (+8 variants)                               | Teleprompter                  |    720 |   0 |  0.91 | informational |   -55% |    720 |
| 29  | speakflow teleprompter                                            | Teleprompter                  |    720 |   0 |  2.59 | informational |   -80% |    720 |
| 30  | marketing video script example                                    | Video scripts & templates     |    720 |   0 |       | informational |  +400% |    720 |
| 31  | how to quickly memorize a script                                  | Video scripts & templates     |    720 |   0 |       | informational |   +23% |    720 |
| 32  | how to memorize a script fast (+1 variants)                       | Video scripts & templates     |    720 |   0 |  2.12 | informational |   +50% |    720 |
| 33  | canva auto captions                                               | Captions & subtitles          |    720 |   0 |       | transactional |   -19% |    720 |
| 34  | script to video ai (+1 variants)                                  | Video scripts & templates     |    880 |  23 |  9.42 | transactional |   -28% |    678 |
| 35  | neewer teleprompter                                               | Teleprompter                  |    720 |   8 |  1.39 | transactional |   +49% |    662 |
| 36  | teleprompter meaning (+1 variants)                                | Teleprompter                  |    590 |   0 |       | informational |   -97% |    590 |
| 37  | teleprompter powerpoint (+1 variants)                             | Teleprompter                  |    590 |   0 |  2.78 | transactional |   +49% |    590 |
| 38  | powerpoint teleprompter                                           | Teleprompter                  |    590 |   0 |  5.25 | transactional |   +22% |    590 |
| 39  | only.fans content ideas                                           | Content ideas                 |    590 |   0 |  6.18 | informational |   -19% |    590 |
| 40  | video script format **(covered)** (+6 variants)                   | Video scripts & templates     |    590 |   0 |  2.67 | informational |    +0% |    590 |

Brand terms (Elgato, BIGVU, Speakflow, Neewer) and hardware terms (teleprompter glass) are listed for completeness; they are not post topics.

## Top keywords per cluster

#### Teleprompter

| Keyword                                |    Vol |  KD | CPC $ | Intent        |  YoY |    Opp |
| -------------------------------------- | -----: | --: | ----: | ------------- | ---: | -----: |
| autocue teleprompter (+1 variants)     | 40,500 |   6 |  2.77 | transactional | -33% | 38,070 |
| teleprompter online                    |  6,600 |  34 |  3.12 | informational |  +0% |  4,356 |
| free teleprompter                      |  5,400 |  31 |  1.59 | informational | -18% |  3,726 |
| teleprompter app (+3 variants)         |  8,100 |  59 |  4.16 | transactional | -18% |  3,321 |
| apps for teleprompter                  |  8,100 |  59 |  4.38 | informational |  +0% |  3,321 |
| online free teleprompter (+5 variants) |  3,600 |  29 |  1.72 | informational |  +0% |  2,556 |
| elgato teleprompter                    |  2,400 |   0 |  1.81 | transactional | -21% |  2,400 |
| what is a teleprompter                 |  2,400 |   0 |  2.17 | informational | +48% |  2,400 |
| teleprompter glass (+2 variants)       |  1,600 |   0 |  2.52 | transactional |  +0% |  1,600 |
| teleprompter what is (+2 variants)     |  1,600 |   0 |  1.36 | informational | -84% |  1,600 |

#### Faceless content

| Keyword                                |    Vol |  KD | CPC $ | Intent        |   YoY |    Opp |
| -------------------------------------- | -----: | --: | ----: | ------------- | ----: | -----: |
| faceless reel (+1 variants)            | 22,200 |   7 |   2.5 | informational | +311% | 20,646 |
| faceless video (+1 variants)           |  4,400 |  17 |  2.32 | informational |  -57% |  3,652 |
| faceless youtube channel (+1 variants) |  2,400 |  14 |  3.91 | navigational  |   +0% |  2,064 |
| faceless reels ai                      |  2,400 |  31 |  3.45 | informational | +511% |  1,656 |
| faceless ai                            |  1,300 |  46 |  3.97 | informational |  -23% |    702 |
| faceless youtube channel idea          |    720 |   7 |  0.87 | informational |  -18% |    670 |
| faceless youtube channel ideas         |    590 |   7 |  1.85 | navigational  |  -33% |    549 |
| is faceless reels legit                |    480 |   0 | 12.25 | commercial    | +700% |    480 |
| faceless youtube                       |    590 |  19 |  3.23 | navigational  |   +0% |    478 |
| faceless reels review                  |    390 |   0 |  3.58 | commercial    | +243% |    390 |

#### Speech topics & random topic generator (SP.ai overlap)

| Keyword                                  |   Vol |  KD | CPC $ | Intent        |  YoY |   Opp |
| ---------------------------------------- | ----: | --: | ----: | ------------- | ---: | ----: |
| random topic generator                   | 6,600 |   4 | 11.97 | informational | +23% | 6,336 |
| impromptu speech                         | 3,600 |   0 |  3.65 | informational |  +0% | 3,600 |
| impromptu speech prompts                 | 1,600 |   0 |  0.29 | informational |  +0% | 1,600 |
| impromptu speech ideas (+5 variants)     | 1,600 |   0 |  0.43 | informational |  +0% | 1,600 |
| what is a impromptu speech (+2 variants) |   880 |   0 |       | informational |  +0% |   880 |
| impromptu speech topic                   |   590 |   0 |  0.01 | informational |  +0% |   590 |
| sample impromptu speech (+8 variants)    |   320 |   0 |  0.01 | informational |  +0% |   320 |
| impromptu speech meaning (+4 variants)   |   320 |   0 |       | informational | -33% |   320 |
| random art topic generator               |   320 |   0 |   3.3 | informational | -19% |   320 |
| random story topic generator             |   320 |  17 |  6.11 | informational | -33% |   266 |

#### Hooks

| Keyword                        |   Vol |  KD | CPC $ | Intent        |   YoY |   Opp |
| ------------------------------ | ----: | --: | ----: | ------------- | ----: | ----: |
| hook ideas (+1 variants)       | 3,600 |  11 |       | informational |   +0% | 3,204 |
| good hook ideas                |   320 |  11 |       | informational |   +0% |   285 |
| hook video                     |   210 |   0 |  3.18 | informational |  -19% |   210 |
| video hook (+1 variants)       |   210 |   4 |  6.64 | informational |  +53% |   202 |
| viral video hooks for reels    |    90 |   3 |  2.81 | informational | +267% |    87 |
| intro hook ideas (+1 variants) |    90 |  14 |       | informational |  +56% |    77 |
| dr hook video                  |    90 |  17 |       | informational |   +0% |    75 |
| hook sentence ideas            |    90 |  21 |       | informational |  +33% |    71 |
| laundry room hook ideas        |    50 |   0 |   0.6 | informational | +325% |    50 |
| key hook ideas                 |    50 |   0 |  0.34 | informational |  -43% |    50 |

#### Transcript extraction (wrong intent)

| Keyword                                            |   Vol |  KD | CPC $ | Intent        |  YoY |   Opp |
| -------------------------------------------------- | ----: | --: | ----: | ------------- | ---: | ----: |
| how to generate script from youtube video          | 5,400 |  41 |  3.56 | informational |  +0% | 3,186 |
| how to get script from youtube video (+1 variants) | 5,400 |  41 |  3.03 | informational |  +0% | 3,186 |
| youtube transcript extractor                       | 4,400 |  41 |  1.87 | informational | +83% | 2,596 |
| tiktok script extractor                            |   880 |   4 |  3.26 | transactional | +83% |   845 |
| youtube script extract (+1 variants)               |   880 |  40 |  2.63 | informational |  +0% |   528 |
| transcript youtube video to text                   |   720 |  42 |  1.99 | informational | -45% |   418 |
| how to find the script of a youtube video          |   590 |  43 |  1.44 | informational | +14% |   336 |
| youtube transcript extension                       |   210 |  46 |  1.72 | informational | -35% |   113 |
| youtube video script extractor                     |    90 |   0 |  2.48 | transactional | -18% |    90 |
| script from youtube video                          |    90 |  18 |  2.13 | informational | -43% |    74 |

#### Video scripts & templates

| Keyword                                                           |   Vol |  KD | CPC $ | Intent        |     YoY |   Opp |
| ----------------------------------------------------------------- | ----: | --: | ----: | ------------- | ------: | ----: |
| how do you write a script for a video **(covered)** (+5 variants) | 2,900 |   0 |  1.58 | informational |   +440% | 2,900 |
| how to make video script **(covered)**                            | 2,900 |   1 |  5.73 | informational |   +400% | 2,871 |
| video script (+6 variants)                                        | 3,600 |  27 |  3.05 | informational |   +184% | 2,628 |
| video with script                                                 | 2,900 |  41 |  3.08 | informational | +28900% | 1,711 |
| video to script                                                   | 2,900 |  41 |  3.08 | informational |    +81% | 1,711 |
| youtube script (+1 variants)                                      | 1,900 |  18 |  2.23 | informational |     +0% | 1,558 |
| writing video script **(covered)** (+4 variants)                  | 1,600 |  12 |  9.51 | informational |   +504% | 1,408 |
| write video script **(covered)** (+3 variants)                    | 1,600 |  12 |     4 | informational |   +519% | 1,408 |
| video tutorial script (+1 variants)                               | 1,300 |   0 |       | informational |   +650% | 1,300 |
| tiktok script                                                     | 1,300 |   9 |   8.8 | informational |    +48% | 1,183 |

#### Content calendar & planning

| Keyword                                              |   Vol |  KD | CPC $ | Intent        |  YoY |   Opp |
| ---------------------------------------------------- | ----: | --: | ----: | ------------- | ---: | ----: |
| content calendar                                     | 4,400 |  36 | 23.14 | informational | -19% | 2,816 |
| sample content calendar (+6 variants)                | 2,400 |  12 | 12.74 | informational | -65% | 2,112 |
| social content calendar (+2 variants)                | 1,900 |  40 | 18.73 | informational | -56% | 1,140 |
| social media content calendar                        | 1,900 |  40 | 18.42 | informational | -45% | 1,140 |
| content calendar templates google sheets             |   880 |   8 |  7.07 | navigational  | -33% |   810 |
| content calendar template google sheets              |   720 |   8 |  6.83 | informational | -41% |   662 |
| content calendar social media template (+1 variants) | 1,000 |  35 | 14.22 | navigational  | -55% |   650 |
| social content calendar template (+7 variants)       |   880 |  35 | 11.68 | informational | -80% |   572 |
| google sheet content calendar (+2 variants)          |   590 |   5 |  3.24 | navigational  |  +0% |   560 |
| content calendar example (+5 variants)               |   590 |  19 |  5.42 | informational | -63% |   478 |

#### Competitor alternatives

| Keyword                        |   Vol |  KD | CPC $ | Intent        |  YoY |   Opp |
| ------------------------------ | ----: | --: | ----: | ------------- | ---: | ----: |
| capcut alternative             | 1,900 |   0 |  5.01 | informational | -32% | 1,900 |
| alternative to capcut          |   590 |   0 |  6.57 | informational | -33% |   590 |
| capcut alternative free        |   390 |   0 |  2.41 | informational | -33% |   390 |
| free capcut alternative        |   260 |   0 |  2.64 | informational | -34% |   260 |
| free alternative to capcut     |   210 |   0 |  1.78 | informational | +24% |   210 |
| capcut alternative for pc      |   170 |   0 |   6.1 | informational | -21% |   170 |
| best capcut alternative        |   140 |   0 |  8.53 | commercial    | -35% |   140 |
| capcut free alternative        |   140 |   0 |  3.33 | informational | +27% |   140 |
| capcut alternative for android |   110 |   0 | 15.77 | informational |  +0% |   110 |
| best alternative to capcut     |    90 |   0 | 11.75 | commercial    | +56% |    90 |

#### AI script writer & generators

| Keyword                                 |   Vol |  KD | CPC $ | Intent        |   YoY |   Opp |
| --------------------------------------- | ----: | --: | ----: | ------------- | ----: | ----: |
| video script writer                     | 1,600 |  12 |  9.51 | commercial    | +504% | 1,408 |
| tiktok script generator                 |   880 |   6 |  7.51 | transactional |  -33% |   827 |
| ai script writer                        | 1,000 |  19 |  5.89 | commercial    |  -55% |   810 |
| script writer ai                        |   480 |  21 |  4.94 | commercial    |  -46% |   379 |
| video script generator                  |   390 |  21 |  4.81 | transactional |  -33% |   308 |
| tiktok creative center script generator |   210 |  10 |       | informational | +100% |   189 |
| ai video script generator               |   210 |  18 |  6.54 | transactional |  -46% |   172 |
| youtube script writer (+1 variants)     |   170 |   0 |  7.95 | commercial    |  +24% |   170 |
| script writer youtube (+1 variants)     |   170 |   0 |  3.71 | informational |  +24% |   170 |
| video to script generator               |   260 |  43 |  4.47 | informational |  +24% |   148 |

#### Short-form video (general)

| Keyword                                 |   Vol |  KD | CPC $ | Intent        |   YoY |   Opp |
| --------------------------------------- | ----: | --: | ----: | ------------- | ----: | ----: |
| short-form video (+3 variants)          | 1,600 |  16 |  8.88 | informational |  +60% | 1,344 |
| short-form video apps (+1 variants)     |   880 |   9 |  2.14 | informational |  -46% |   801 |
| short-form video app (+1 variants)      |   880 |   9 |  4.42 | transactional | +420% |   801 |
| short-form video marketing              |   720 |  20 | 11.46 | commercial    |  -93% |   576 |
| short form video marketing              |   590 |  19 |       | informational |  -97% |   478 |
| short form video platform               |   320 |   7 |       | informational | +555% |   298 |
| short-form video platform (+2 variants) |   260 |   2 |  2.56 | informational |  -58% |   255 |
| short form video editor (+2 variants)   |   210 |   0 |  7.91 | transactional |  +50% |   210 |
| what is short-form video                |   210 |  17 |       | informational | +457% |   174 |
| short-form content video (+3 variants)  |   210 |  18 |       | informational |   +0% |   172 |

#### Captions & subtitles

| Keyword                                            |   Vol |  KD | CPC $ | Intent        |  YoY |   Opp |
| -------------------------------------------------- | ----: | --: | ----: | ------------- | ---: | ----: |
| add captions to video (+1 variants)                | 1,900 |  34 |  4.21 | informational | -33% | 1,254 |
| capcut auto captions                               | 1,300 |   8 |  3.73 | transactional | +22% | 1,196 |
| auto captions                                      | 2,400 |  51 |  3.37 | informational | +53% | 1,176 |
| how to add captions to video (+5 variants)         | 1,300 |  31 |  5.79 | informational | +23% |   897 |
| auto captions youtube                              | 1,000 |  27 |  3.38 | informational | +81% |   730 |
| canva auto captions                                |   720 |   0 |       | transactional | -19% |   720 |
| auto captions generator                            |   880 |  38 |  3.08 | informational |  +0% |   546 |
| how to add captions to youtube video (+1 variants) |   720 |  39 |  2.47 | informational |  +0% |   439 |
| how to add captions on youtube video               |   720 |  39 |   2.9 | informational | +22% |   439 |
| how to add closed captions to a video              |   480 |  14 |  3.86 | informational |  +0% |   413 |

#### Cross-posting & scheduling

| Keyword                                             |   Vol |  KD | CPC $ | Intent        |  YoY | Opp |
| --------------------------------------------------- | ----: | --: | ----: | ------------- | ---: | --: |
| cross post                                          | 1,000 |  12 | 10.04 | navigational  | +60% | 880 |
| reddit how to cross post                            |   320 |   0 |       | informational | -33% | 320 |
| how to cross post from facebook to instagram        |   320 |   5 |       | informational | +50% | 304 |
| what is cross post                                  |   260 |  10 |       | informational | +53% | 234 |
| cross post from facebook to instagram (+3 variants) |   210 |   4 |  0.02 | navigational  | -19% | 202 |
| cross post app                                      |   260 |  24 |  5.62 | navigational  | +52% | 198 |
| how do you cross post on facebook                   |   140 |   5 |       | informational | -36% | 133 |
| how to cross post reddit                            |   110 |   0 |       | informational | +56% | 110 |
| cross post reddit                                   |    90 |   0 |       | navigational  | -55% |  90 |
| cross post social media                             |    90 |   1 | 18.96 | navigational  | -57% |  89 |

#### Content ideas

| Keyword                                | Vol |  KD | CPC $ | Intent        |  YoY | Opp |
| -------------------------------------- | --: | --: | ----: | ------------- | ---: | --: |
| content ideas                          | 880 |   1 | 11.31 | informational |  +0% | 871 |
| only.fans content ideas                | 590 |   0 |  6.18 | informational | -19% | 590 |
| content ideas social media             | 480 |   7 | 10.17 | informational | -19% | 446 |
| social content ideas (+2 variants)     | 390 |   7 | 13.42 | informational | -64% | 363 |
| ideas for content creation             | 320 |   0 |  7.23 | informational | -33% | 320 |
| reels ideas                            | 320 |   0 |  8.22 | informational | -33% | 320 |
| tiktok content ideas                   | 260 |  10 |   1.8 | informational |  +0% | 234 |
| instagram reels ideas                  | 210 |   0 |  10.6 | informational | -46% | 210 |
| ig reels ideas                         | 210 |   0 |  2.44 | informational | -33% | 210 |
| content ideas for tiktok (+1 variants) | 210 |  10 | 12.64 | informational |  +0% | 189 |

#### Talking to camera & on-camera confidence

| Keyword                                   | Vol |  KD | CPC $ | Intent        |   YoY | Opp |
| ----------------------------------------- | --: | --: | ----: | ------------- | ----: | --: |
| talking head video                        | 390 |   0 |  7.14 | informational |  +51% | 390 |
| video talking head                        | 320 |   0 |       | informational |  -18% | 320 |
| what is a talking head video              | 260 |   0 |   4.7 | informational | +179% | 260 |
| how to film yourself                      |  90 |   0 |   0.6 | informational |  -36% |  90 |
| how to film yourself on mac (+1 variants) |  90 |   0 |  4.44 | informational |  +22% |  90 |
| how to film yourself with a phone         |  90 |   0 |   0.7 | informational | +100% |  90 |
| how to film yourself on macbook           |  90 |   0 |   4.1 | informational |  +29% |  90 |
| talking head video meaning                |  90 |   0 |       | informational |  +80% |  90 |
| talk to camera                            |  90 |   0 |       | informational | +100% |  90 |
| talk to the camera                        |  90 |   2 |       | informational |  +55% |  88 |

#### Silence & filler removal / text-based editing

| Keyword                                                         | Vol |  KD | CPC $ | Intent        |   YoY | Opp |
| --------------------------------------------------------------- | --: | --: | ----: | ------------- | ----: | --: |
| text based video editing (+1 variants)                          |  50 |   5 | 14.21 | commercial    |  -71% |  48 |
| remove silence from video                                       |  40 |   0 |       | informational |  -82% |  40 |
| text based video editing software (+1 variants)                 |  30 |   0 |       | commercial    |  +50% |  30 |
| what is text-based video editing                                |  30 |   2 |       | informational | +300% |  29 |
| capcut auto cut silence                                         |  20 | ~25 |       | transactional |  -50% |  15 |
| davinci resolve auto cut silence                                |  20 | ~25 |       | informational |  -33% |  15 |
| text-based editing of talking-head video (+3 variants)          |  10 |  14 |       | informational |       |   9 |
| remove silence from video online free (+9 variants)             |  10 |  47 |       | informational | -100% |   5 |
| automatically remove silence from video free                    |  10 | ~25 |       | informational |  -50% |   8 |
| how to remove silence from a video automatically (+12 variants) |  10 |  48 |       | informational |   +0% |   5 |

## Questions people ask

### From keyword data (high/medium fit, variants deduped)

| Question                                                          | Cluster                                  |   Vol |   KD | CPC $ | Intent        |    YoY |   Opp |
| ----------------------------------------------------------------- | ---------------------------------------- | ----: | ---: | ----: | ------------- | -----: | ----: |
| Question                                                          | Cluster                                  |   Vol |   KD | CPC $ | Intent        |    YoY |   Opp |
| ---                                                               | ---                                      |  ---: | ---: |  ---: | ---           |   ---: |  ---: |
| how do you write a script for a video **(covered)** (+5 variants) | Video scripts & templates                | 2,900 |    0 |  1.58 | informational |  +440% | 2,900 |
| how to make video script **(covered)**                            | Video scripts & templates                | 2,900 |    1 |  5.73 | informational |  +400% | 2,871 |
| what is a teleprompter                                            | Teleprompter                             | 2,400 |    0 |  2.17 | informational |   +48% | 2,400 |
| teleprompter what is (+2 variants)                                | Teleprompter                             | 1,600 |    0 |  1.36 | informational |   -84% | 1,600 |
| how to create video script **(covered)** (+3 variants)            | Video scripts & templates                | 1,300 |   13 |  6.34 | informational | +1015% | 1,131 |
| how to get youtube video script                                   | Video scripts & templates                | 1,900 |   50 |   2.5 | informational |    +0% |   950 |
| how to add captions to video (+5 variants)                        | Captions & subtitles                     | 1,300 |   31 |  5.79 | informational |   +23% |   897 |
| how to memorize a script                                          | Video scripts & templates                |   880 |    0 |   0.1 | informational |    +0% |   880 |
| how teleprompter work (+8 variants)                               | Teleprompter                             |   720 |    0 |  0.91 | informational |   -55% |   720 |
| how to quickly memorize a script                                  | Video scripts & templates                |   720 |    0 |       | informational |   +23% |   720 |
| how to memorize a script fast (+1 variants)                       | Video scripts & templates                |   720 |    0 |  2.12 | informational |   +50% |   720 |
| how to add captions to youtube video (+1 variants)                | Captions & subtitles                     |   720 |   39 |  2.47 | informational |    +0% |   439 |
| how to add captions on youtube video                              | Captions & subtitles                     |   720 |   39 |   2.9 | informational |   +22% |   439 |
| how to add closed captions to a video                             | Captions & subtitles                     |   480 |   14 |  3.86 | informational |    +0% |   413 |
| what is a content calendar                                        | Content calendar & planning              |   390 |   19 |       | informational |  +233% |   316 |
| how to cross post from facebook to instagram                      | Cross-posting & scheduling               |   320 |    5 |       | informational |   +50% |   304 |
| how to create a content calendar for social media (+3 variants)   | Content calendar & planning              |   480 |   40 | 11.26 | informational | +2082% |   288 |
| how to add captions to a video in canva                           | Captions & subtitles                     |   260 |    0 |       | informational |   -46% |   260 |
| what is a talking head video                                      | Talking to camera & on-camera confidence |   260 |    0 |   4.7 | informational |  +179% |   260 |
| does davinci resolve have auto captions                           | Captions & subtitles                     |   260 |    0 |       | informational |   +24% |   260 |
| what is cross post                                                | Cross-posting & scheduling               |   260 |   10 |       | informational |   +53% |   234 |
| how to turn off auto captions on youtube                          | Captions & subtitles                     |   260 |   11 |       | informational |  +425% |   231 |
| what does the teleprompter look like (+1 variants)                | Teleprompter                             |   210 |    0 |  0.55 | informational |   -71% |   210 |
| what does a teleprompter look like                                | Teleprompter                             |   210 |    4 |  1.25 | informational |   +55% |   202 |
| what is short-form video                                          | Short-form video (general)               |   210 |   17 |       | informational |  +457% |   174 |
| how to write a youtube video script **(covered)** (+3 variants)   | Video scripts & templates                |   170 |    0 | 11.99 | informational |    +0% |   170 |
| how to add captions to canva video                                | Captions & subtitles                     |   170 |    1 |       | informational |   -48% |   168 |
| how to make content calendar (+1 variants)                        | Content calendar & planning              |   210 |   23 | 21.92 | informational |   -56% |   162 |
| what is short form video                                          | Short-form video (general)               |   170 |   16 |       | informational |   -18% |   143 |
| does capcut have a teleprompter                                   | Teleprompter                             |   140 |    0 |  0.53 | commercial    |   +91% |   140 |

### Google People Also Ask (live SERPs, 2026-10-24)

- **how to write a video script:** How to script a video essay? What are the three C's of writing a good script? What are the different types of scripts? How do I create my own script? Can ChatGPT write scripts? How to write a script as a beginner?
- **teleprompter for mac:** How to do a teleprompter on Mac? What is the best desktop teleprompter? Does Apple have a teleprompter app? Is there a truly free teleprompter app?
- **hook ideas:** What are the 7 types of hooks? What's a hook on TikTok?
- **how to memorize a script:** What is the 7-3-2-1 method?

### Reddit, X and Quora

- r/NewTubers: [Is it better to write out a script word for word?](https://www.reddit.com/r/NewTubers/comments/18o6hlk/is_it_better_to_write_out_a_script_word_for_word/) and [Scripting vs talking off the cuff](https://www.reddit.com/r/NewTubers/comments/1vlujb3/scripting_vs_talking_off_the_cuff/): full script or bullet points, and how to not sound like you're reading.
- r/ContentCreators: [Do you use a teleprompter for scripted videos?](https://www.reddit.com/r/ContentCreators/comments/1uez6dq/do_you_use_a_teleprompter_for_scripted_videos/), [Best teleprompter app for beginners](https://www.reddit.com/r/ContentCreators/comments/1nqfck3/whats_the_best_teleprompter_app_for_beginners_vs/), [How can you sound more confident on camera](https://www.reddit.com/r/ContentCreators/comments/1q7cgr2/how_can_you_sound_more_confident_on_camera).
- r/VideoEditing: [How to record a video while reading a script](https://www.reddit.com/r/VideoEditing/comments/1lvoyev/how_to_record_a_video_while_reading_a_script/).
- r/content_marketing: [How do you create talking head videos?](https://www.reddit.com/r/content_marketing/comments/1ooylsb/how_do_you_create_talking_head_videos/)
- r/PartneredYoutube: [Question for anyone who does talking-head style](https://www.reddit.com/r/PartneredYoutube/comments/1bgi0lq/question_for_anyone_who_does_talking_head_style/)
- r/macapps: [open-source teleprompter for Mac](https://www.reddit.com/r/macapps/comments/1r0efe9/) (ranks #2 for "teleprompter for mac").
- X: [how to write a video script](https://x.com/ArchimedesVt/status/2080423066874622406), [not sounding scripted](https://x.com/peteugc/status/2097019252213780713), [speaking naturally on camera](https://x.com/DailyUpdate44/status/2109494594601910733). X had little discussion on these topics.
- Quora ranks #3 for "how to write a video script" with scattered tips on educational scripts.

Recurring themes: word-for-word script versus bullet points; sounding natural while reading; where to put the teleprompter; how long a script should be for Shorts/Reels; feeling awkward on camera.

## SERP spot-checks (2026-10-24)

US desktop, top results:

| Query                                     | Who ranks                                                                                                                                  | Weakness                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| how to write a video script **(covered)** | AI overview; Adobe (screenplay format); YouTube; Quora; kimbrattain.com (generic 8 steps); Forbes (2018); Facebook group; 2 YouTube videos | Nobody writes for a solo creator; no filled-in short script with word counts; no full-script vs talking-points rule; no teleprompter formatting. **Covered 2026-10-24.** |
| video script template **(covered)**       | storykit.io, documentero, template.net, YouTube, uscreen, videolearningai, clipcreator.ai                                                  | Template farms and tool pages. **Covered 2026-10-24** (template in the post)                                                                                             |
| teleprompter for mac                      | App Store (Teleprompter Pro), r/macapps, teleprompter.com, teleprompterpro, GitHub textream, CuePrompter, voiceprompter, speakflow         | App vendors; Yapper's feature page is not in the top 10                                                                                                                  |
| talking head video                        | YouTube, pixabay (stock), deburghgroup, vidpromom                                                                                          | Thin; PAA off-topic                                                                                                                                                      |
| how to be confident on camera             | YouTube, r/ContentCreators, heyjessica, joycelayman, elisajames                                                                            | Coach blogs; low US volume (10–50/mo)                                                                                                                                    |
| content ideas                             | contentideas.io, r/content_marketing, rachelpedersen, copy.ai, edwardsturm                                                                 | Generic lists                                                                                                                                                            |
| hook ideas                                | lyfemarketing, madsocialagency, stlcc (essay hooks), medium, creatorflow, r/socialmedia                                                    | Mixed intent: essay hooks and video hooks                                                                                                                                |
| how to memorize a script                  | r/acting, NYFA, the-modern-actor, dramatics.org, magneticmemorymethod                                                                      | Actor-focused; nothing for creators                                                                                                                                      |
| text based video editing                  | Descript, soundstripe, Adobe helpx, r/podcasting, Vimeo, choppity                                                                          | Tool vendors; low volume (50)                                                                                                                                            |
| capcut alternative                        | 19pine, techpoint.africa, r/CapCut, slateteams, nemovideo                                                                                  | Listicles; Yapper is Mac-only, so fit is partial                                                                                                                         |
| 1 minute speech topics                    | wordwall, aippt, AskReddit, YouTube, Quora, myperfectwords                                                                                 | ypr.app not in US desktop top 10 (GSC average 9.6 is helped by India)                                                                                                    |
| unprompted topic generator                | unpromptedtopicgenerator.com, Instagram, randomtopics.app, aat.ee                                                                          | ypr.app not in top 9 in this check, though GSC averages 7.3                                                                                                              |

## Prioritized post topics

| #   | Topic                                                          | Primary keyword (vol / KD)                | Secondary                                                                                                          | Why                                                                                                                      | Status                                             |
| --- | -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | How to write a video script for talking to camera              | how to write a video script (2,900 / 1)   | write a video script, how to make a video script, video script template, video script example                      | Largest easy cluster, +440% YoY, weak SERP, directly feeds AI script writer + teleprompter                               | **Covered** 2026-10-24 ([log](./blog-post-log.md)) |
| 2   | Video script examples for Reels, Shorts and YouTube            | marketing video script example (720 / 0)  | video tutorial script (1,300 / 0), video script examples (390 / 3), youtube script (1,900 / 18)                    | Example-led follow-up; links to #1                                                                                       | Planned                                            |
| 3   | Teleprompter app for Mac: how to set one up and read naturally | teleprompter app for mac (720 / 19)       | teleprompter for mac (1,000 / 55), free teleprompter for mac (170 / 21), does capcut have a teleprompter (140 / 0) | Product page target; needs a fair comparison including free options                                                      | Planned                                            |
| 4   | What is a teleprompter and how does it work (for creators)     | what is a teleprompter (2,400 / 0)        | how teleprompter works (720 / 0), teleprompter script (260 / 32)                                                   | Easy informational volume; top of funnel                                                                                 | Planned                                            |
| 5   | Hook ideas for talking-head videos                             | hook ideas (3,600 / 11)                   | video hooks (210 / 4), good hook ideas (320 / 11), viral video hooks for reels (90 / 3)                            | Answer "7 types of hooks" PAA with video examples                                                                        | Planned                                            |
| 6   | How to memorize a script (or when not to)                      | how to memorize a script (880 / 0)        | how to memorize a script fast (720 / 0), how to quickly memorize a script (720 / 0)                                | Actor-only SERP; creator angle with teleprompter alternative                                                             | Planned                                            |
| 7   | TikTok and YouTube Shorts scripts                              | tiktok script (1,300 / 9)                 | youtube script (1,900 / 18), how to write a youtube video script (170 / 0), youtube script template (110 / 0)      | Platform-specific spin-off of #1                                                                                         | Planned                                            |
| 8   | Talking head video: what it is and how to make one             | talking head video (390 / 0)              | what is a talking head video (260 / 0), video talking head (320 / 0), how to film yourself on mac (90 / 0)         | Exact product audience; thin SERP                                                                                        | Planned                                            |
| 9   | Content ideas for creators who talk to camera                  | content ideas (880 / 1)                   | content ideas social media (480 / 7), ideas for content creation (320 / 0), reels ideas (320 / 0)                  | Partly covered by /blog/how-to-generate-content-ideas; refresh that post's title/headers rather than writing a duplicate | Refresh                                            |
| 10  | How to add captions to a talking video                         | how to add captions to video (1,300 / 31) | how to add closed captions to a video (480 / 14), auto captions youtube (1,000 / 27)                               | Feature fit; KD higher                                                                                                   | Planned                                            |
| 11  | Sample content calendar for a solo creator                     | sample content calendar (2,400 / 12)      | content calendar template google sheets (880 / 8), what is a content calendar (390 / 19)                           | Medium fit; high CPC                                                                                                     | Planned                                            |
| 12  | CapCut alternatives for Mac creators                           | capcut alternative (1,900 / 0)            | alternative to capcut (590 / 0), capcut alternative free (390 / 0), descript alternative (210 / 0)                 | Commercial intent; must be honest that Yapper is Mac-only                                                                | Planned                                            |

Not planned: faceless content (Yapper is for appearing on camera), transcript extraction, and every speakingpractice.ai overlap topic.

## Methodology

- **Seeds (DataForSEO Labs keyword_suggestions, 38 seeds):** video script, youtube script, tiktok script, teleprompter, teleprompter app, teleprompter for mac, teleprompter script, ai script writer, hook ideas, video hook, content ideas, content idea generator, reels ideas, talking head video, talk to camera, on camera, confident on camera, how to film yourself, record yourself talking, how to memorize a script, text based video editing, remove silence from video, cut silence, auto captions, add captions to video, cross post, post to multiple social media, content calendar, batch content, short form video, capcut alternative, descript alternative, faceless, plus 1 minute speech, impromptu speech and random topic generator to measure overlap.
- **related_keywords (depth 1):** how to write a youtube script, teleprompter app, video hooks, how to come up with content ideas, how to be confident on camera.
- **Merge and clean:** 4,500 unique keywords merged, then a regex excludes off-topic matches (car and doorbell cameras, coat hooks, screenplays, essays, calendars for print, other exams). 3,453 keywords were classified into 15 clusters by rule order.
- **Ranked keywords:** `ranked_keywords` for ypr.app in US (73) and India (16).
- **GSC:** Search Analytics API, query, page and query+page for 28 and 90 days.
- **SERPs:** `serp/google/organic/live/advanced` for 12 queries, US desktop, People Also Ask depth 1, plus Google search in the browser and reading the top pages for the chosen post.
- **Spend:** about $1.12 of DataForSEO credit for this research (suggestions, related, ranked, SERP).
- **Limits:** volumes are Google Ads ranges and close variants share a figure; KD is DataForSEO's estimate. GSC positions are averages across countries and devices.

## Related docs

- [docs/seo/page-keyword-matrix-2026-10-01.md](../../docs/seo/page-keyword-matrix-2026-10-01.md)
- [docs/seo/studio-consolidation-2026-10-08.md](../../docs/seo/studio-consolidation-2026-10-08.md)
- [docs/seo/research-2026-10-09/README.md](../../docs/seo/research-2026-10-09/README.md) (Semrush)
- [docs/seo-research-2026-08.md](../../docs/seo-research-2026-08.md), [docs/keyword_research.md](../../docs/keyword_research.md)
