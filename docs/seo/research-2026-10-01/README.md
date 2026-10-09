# Yapper SEO research, October 1, 2026

This is the evidence base for splitting ypr.app into Yapper Train and Yapper Studio. It replaces the first pass written earlier the same day, which had no first-party data and no current keyword volumes. The decisions that follow from it are in [the architecture plan](../../product-architecture-and-seo-plan.md), the per-page targets are in [the page and keyword matrix](../page-keyword-matrix-2026-10-01.md).

Nothing here is a ranking forecast. Read every number with its source and date.

## Sources and what each one can support

| Source                                                                                  | Retrieved                                        | Scope                                                                                                                                | Kind of evidence                               | Stored                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| Google Search Console API, property `sc-domain:ypr.app`, service account `gsc-reader`   | Oct 1, 2026                                      | Web search, finalized data, all countries. 28 days Aug 31 to Sep 27, the 28 days before (Aug 3 to Aug 30), and 90 days ending Sep 27 | Observed first-party performance               | Raw JSON in `private/` (gitignored). Aggregates below |
| Production crawl of ypr.app, 51 sitemap URLs plus 13 extra paths, no redirects followed | Oct 1, 2026                                      | Status, title, description, canonical, robots, H1, H2, JSON-LD types, internal links                                                 | Observed production state                      | `production-crawl.json`, script `production-crawl.py` |
| DataForSEO Labs keyword overview, Google, United States, English                        | Oct 1, 2026 (provider data updated Sep 12 to 17) | 52 seed keywords                                                                                                                     | Third-party estimates of volume and difficulty | `dataforseo-us-en.json`                               |
| DataForSEO live Google SERP, United States, English, desktop, top 10                    | Oct 1, 2026                                      | 9 queries (a tenth, "impromptu speech topics", failed in transit and was not retried)                                                | Qualitative SERP observation                   | Summarized below                                      |
| Higgsfield pricing page, read in a browser                                              | Oct 1, 2026                                      | Plan mechanics                                                                                                                       | Qualitative reference for pricing              | Summarized in `docs/pricing-2026-10.md`               |

Unavailable, and not replaced with guesses:

| Wanted                                                                  | What happened                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semrush keyword, domain and competitor reports                          | The API helper in celpip-practice answered "Semrush tools unavailable; check its OAuth connection" on the one check made. The browser attempt earlier today in the Can profile hit "You've used 10 free requests" (`semrush-access.txt`). No trial, upgrade or retry. |
| Semrush Content Optimizer reviews                                       | Same access problem. Every page is marked pending in the matrix. No scores are claimed.                                                                                                                                                                              |
| PostHog landing sessions, practice completions, signups by landing page | The PostHog connection in this session reaches only the CELPIP organization. Yapper reports to a different project key. Conversion by product intent is therefore unknown, not zero.                                                                                 |
| Bing Webmaster data                                                     | The stored key covers the CELPIP domains only. Not checked for ypr.app.                                                                                                                                                                                              |
| Backlinks and referring domains to `/studio` and other URLs             | Not pulled. Search Console's links report is not in the API.                                                                                                                                                                                                         |

## What Search Console shows

Property totals, from the device breakdown (query rows hide anonymized queries, and page rows count anchor links as separate rows, so neither is used for totals):

| Window                     | Clicks | Impressions |
| -------------------------- | -----: | ----------: |
| Aug 31 to Sep 27 (28 days) |    110 |       5,236 |
| Aug 3 to Aug 30 (28 days)  |    214 |       7,179 |
| 90 days ending Sep 27      |    731 |      22,863 |

Clicks fell 49% between the two 28 day windows. The data does not say why. The homepage changed from the topic generator to a Studio landing page during this period, and that is a hypothesis worth testing, not a finding.

Pages, 90 days ending Sep 27:

| Page                                      |  Clicks | Impressions | Avg position |
| ----------------------------------------- | ------: | ----------: | -----------: |
| `/blog/1-minute-speech-topics`            |     435 |      11,953 |         10.1 |
| `/`                                       |     210 |       6,605 |          8.0 |
| `/blog/random-topic-generator-with-timer` |      34 |       1,004 |         14.9 |
| `/blog/random-topic-generator`            |      20 |         595 |         14.8 |
| `/blog/speech-topic-ideas-for-practice`   |      10 |         530 |         26.2 |
| `/tools/words-per-minute`                 |       0 |         620 |         50.1 |
| `/blog/good-speech-topics`                |       2 |         426 |         33.7 |
| `/studio`                                 |       0 |          62 |         14.3 |
| `/training`                               |       2 |          29 |         10.6 |
| All nine `/features/*` pages combined     |       3 |          48 |       varies |
| `/training/random-topic-generator`        | no rows |     no rows |         none |

Two pages earn 88% of clicks. Both are speaking practice.

What the homepage ranks for (query and page rows, 90 days): "unprompted topic generator" (773 impressions, position 7.1), "unprompted random topic generator" (211), "speech topic generator" (105), "random speech topic generator" (65), "random topic generator for speech" (57), and about 60 more variants of the same intent, almost all at positions 6 to 10. The brand term "yapper" adds 1,096 impressions at position 6.6 and 4 clicks. Searchers who type "yapper" mostly want something else (slang, a social app), so that click rate is not a problem to solve.

Grouping the visible 90 day query rows: topic generator variants 57 clicks from 2,156 impressions, speech topic lists 55 from 2,060, brand 8 from 1,418, anything related to Studio (teleprompter, script, caption, editing, scheduling, content) 0 clicks from 10 impressions.

Countries, 90 days: India 144 clicks, United States 96, United Kingdom 43, Germany 39, Canada 28, Indonesia 22, Australia 17. Impressions are led by the United States (4,386) and India (4,328). The audience is English speaking and spread across many countries. There is no evidence for targeting one country, and nothing from celpip-practice's Canadian focus carries over. US volumes are used below as a common reference, not as the market.

Devices, 90 days: desktop 358 clicks, mobile 345, tablet 28.

### What follows from this

1. Yapper's organic traffic today is Train traffic. Studio has none to protect.
2. The homepage is the page Google ranks for topic generator searches, because it used to be the generator. The generator now lives at `/training/random-topic-generator`, which has no impressions yet. Turning the homepage into a brand page puts those rankings at risk until Google moves them to the generator page. This is the main SEO risk in the restructure and it is measured explicitly in the plan.
3. For the head term "random topic generator" the site sits around position 34. The clicks come from longer speech-specific variants.

## Third-party keyword estimates

DataForSEO, Google, United States, English. Monthly volume and keyword difficulty (0 to 100). A dash means the provider returned no difficulty. Unknown is not zero. Variants overlap, so do not add them up.

Train:

| Keyword                         | Volume |  KD | Intent        |
| ------------------------------- | -----: | --: | ------------- |
| random topic generator          |  6,600 |   4 | informational |
| interview practice              |  2,400 |  35 | informational |
| words per minute calculator     |  2,400 |   - | informational |
| impromptu speech topics         |  1,600 |   - | informational |
| practice speaking english       |  1,600 |  52 | informational |
| ai interview practice           |  1,300 |  33 | informational |
| table topics questions          |  1,300 |   - | informational |
| mock interview ai               |    880 |  17 | informational |
| public speaking practice        |    390 |  12 | informational |
| public speaking app             |    320 |  18 | transactional |
| how to practice public speaking |    170 |  16 | informational |
| public speaking exercises       |    170 |   4 | informational |
| speech topic generator          |    140 |   - | informational |
| read aloud practice             |    140 |   - | informational |
| speech coach app                |     90 |  42 | transactional |
| ai speech coach                 |     70 |  38 | commercial    |
| 1 minute speech topics          |     70 |   - | informational |
| ai public speaking coach        |     50 |  19 | commercial    |
| speaking practice app           |     50 |  19 | transactional |
| public speaking practice online |     30 |  22 | informational |
| impromptu speaking practice     |     20 |   - | informational |
| filler word counter             |     10 |   - | informational |

Studio:

| Keyword                        | Volume |  KD | Intent        |
| ------------------------------ | -----: | --: | ------------- |
| social media scheduler         | 90,500 |  33 | commercial    |
| teleprompter app               |  8,100 |  59 | transactional |
| content creation app           |  6,600 |   - | commercial    |
| teleprompter online            |  6,600 |  34 | informational |
| content calendar               |  4,400 |  36 | informational |
| auto captions                  |  2,400 |  51 | informational |
| add captions to video          |  1,900 |  34 | informational |
| content creator tools          |  1,900 |   - | commercial    |
| capcut alternative             |  1,900 |   - | informational |
| video creation software        |  1,600 |  70 | commercial    |
| ai script writer               |  1,000 |  19 | commercial    |
| ai thumbnail generator         |    880 |  39 | transactional |
| video caption generator        |    880 |  34 | informational |
| video script generator         |    390 |  21 | transactional |
| content library                |    390 |   - | informational |
| content idea generator         |    260 |  29 | informational |
| ai video script generator      |    210 |  18 | transactional |
| content planning tool          |    210 |  29 | commercial    |
| descript alternative           |    210 |   - | informational |
| short form video editor        |    170 |   - | transactional |
| text based video editing       |     50 |   5 | commercial    |
| teleprompter recorder          |     30 |  50 | transactional |
| remove filler words from video |     20 |   - | informational |
| transcript video editor        |     10 |   - | transactional |
| talking head video editor      |     10 |   - | commercial    |

Brand and competitors: yapper 8,100 (mixed intent, see above), yoodli 9,900, orai app 260.

Yapper's own first-party data disagrees with one estimate in a useful way. "1 minute speech topics" shows 70 searches a month in the US, yet the post ranking for it and its long variants drew 11,953 impressions worldwide in 90 days. Long-tail demand is much larger than any single head term's estimate. Treat volumes as a guide to relative size.

The August 2026 summary in `docs/seo-research-2026-08.md` reported some different figures (for example "content creation app" at 9,900 and "social media scheduler" at 60,500). Today's pull supersedes them. The April ranges in `docs/keyword_research.md` have no provider export and are not used.

## What ranks, by query

Observed Oct 1, United States, desktop. Positions vary by place and day. These describe page types, not targets to copy, and say nothing about why a page ranks.

| Query                    | What the first page is made of                                                                                                                                                                                                                | What it means for Yapper                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| random topic generator   | Single-purpose tool pages: codebeautify.org, randomtopics.app, randomtopicgen.com, speechtopicgen.com, capitalizemytitle.com, randomtopicgenerator.net, plus a Reddit thread and an Instagram reel from the creator behind randomtopicgen.com | The searcher wants a tool that works on load. `/training/random-topic-generator` is the right owner. Two of the ranking sites are speech-practice generators, so the speaking angle is a real segment of this query                 |
| public speaking practice | AI overview, then advice articles (Lifehack, IEEE, MIT), forums, a Udemy course                                                                                                                                                               | Informational. The blog guides own it. `/training` supports with exercises                                                                                                                                                          |
| public speaking app      | App store listings (Google Play, App Store), VR app articles, Reddit threads from people who built practice apps, an Orai review                                                                                                              | Searchers expect an installable app. Train is a web app. The product page can describe what Train is but should not imply a store app                                                                                               |
| ai interview practice    | Dedicated products: interviewsby.ai, Big Interview, StandOut, InterviewCoach.AI, Exponent, plus Google and Harvard career pages                                                                                                               | These tools generate questions from a job description and run a mock interview. Train's interview exercise offers prompts and feedback on a recorded answer. It should say that plainly and not present itself as an AI interviewer |
| teleprompter app         | App Store and Google Play listings, forum threads, YouTube roundups of free apps                                                                                                                                                              | Install and free intent. Studio's teleprompter is behind an invitation, so it cannot meet this intent today                                                                                                                         |
| ai script writer         | Screenwriting tools (Laper, Squibler, Storyflow), generic generators (QuillBot, DeepAI), Powtoon and Creatify for video                                                                                                                       | Mixed between screenplays and video scripts. "Video script generator" is the closer match for Studio                                                                                                                                |
| video caption generator  | Free online caption tools (ShortSync, Castmagic, short.ai), and several results about social post captions                                                                                                                                    | The word "caption" is ambiguous between timed subtitles and post text. The page must say "video" and "subtitles"                                                                                                                    |
| text based video editing | Descript, Adobe's Premiere help page, Vimeo, Choppity, Visla, Soundstripe's roundup                                                                                                                                                           | A defined category with strong incumbents and low volume. Useful for describing the feature accurately, small as a traffic source                                                                                                   |
| content creation app     | App Store listings, LinkedIn and Substack posts, a nonprofit tools roundup, social video "perspectives"                                                                                                                                       | Broad and unfocused. Not a sensible target for the homepage                                                                                                                                                                         |

## Limits

Search Console query rows omit anonymized queries, so query-level sums undercount. Page rows include anchor-link URLs as separate rows. The 28 day comparison spans site changes whose dates were not reconstructed, so no cause is assigned to the drop. DataForSEO volumes are modeled estimates for one country. SERPs were read once, on desktop, from one location. Conversion data was not available, so nothing here says which queries produce practice sessions, signups or waitlist entries.

## Next evidence to get

1. Yapper's PostHog project: organic landing sessions by page, practice starts and completions, feedback requests, waitlist submissions. This needs a connection to the right project.
2. Semrush, once the intended plan is active in the Can profile: the same 52 seeds, the Content Optimizer reviews in the matrix, and keyword overlap with randomtopicgen.com, speechtopicgen.com and yoodli.com.
3. Search Console's links report for `/studio` and `/` before any further URL change.
