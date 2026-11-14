# Mobile pricing: cost per one-cut edit and a draft credit schedule

Written November 13, 2026. Draft for a decision. Nothing in the catalog, Stripe or the app was changed.

The numbers come from the live catalog (`src/lib/billing/paid-actions.ts` and `plans.ts`, last repriced October 12 in #287), provider list prices from `unit-economics-and-pricing.md`, the `$ai_generation` events in PostHog, and the `edit_runs` table. `pricing-2026-10.md` describes an older schedule (500 credits a month, different action costs) and should not be used for this.

## What one cut costs today

A one-cut edit is two paid actions. Transcription charges 4 credits per started 3 minutes of footage. Cleanup charges a flat 8 credits. The Creator plan is $24.99 a month for 1,000 credits ($0.025 a credit) or $199.99 a year for 12,000 ($0.0167 a credit).

Provider cost at list price is about $0.0075 per minute of footage for transcription and about $0.0006 per minute for cleanup. The transcription figure is Deepgram Nova-3 at $0.0043 a minute, plus $0.0013 for dictionary keyterms, times 1.33 because the Mac app sends 120 second pieces with 30 seconds of overlap. Cleanup on gemini-3.7-flash measured $0.008 for a 14 minute take in the September eval, and the five cleanup calls in PostHog averaged $0.0028 each.

| Raw footage | Credits today | Charged, monthly plan | Our cost, typical | Our cost, bad day | Edits from 1,000 credits |
| ----------- | ------------: | --------------------: | ----------------: | ----------------: | -----------------------: |
| 1 minute    |            12 |                 $0.30 |             $0.01 |             $0.02 |                       83 |
| 3 minutes   |            12 |                 $0.30 |             $0.03 |             $0.04 |                       83 |
| 5 minutes   |            16 |                 $0.40 |             $0.04 |             $0.06 |                       62 |
| 10 minutes  |            24 |                 $0.60 |             $0.08 |             $0.11 |                       41 |
| 15 minutes  |            28 |                 $0.70 |             $0.12 |             $0.17 |                       35 |
| 30 minutes  |            48 |                 $1.20 |             $0.24 |             $0.33 |                       20 |

"Bad day" adds 25% to transcription for the recovery passes that re-send windows where speech was missed, and assumes cleanup used all three of its attempts.

Cleanup is charged at 8 credits ($0.20) and costs under one cent, so nearly all of the margin sits in an action whose price has nothing to do with take length. A short take also costs the user the same 12 credits whether it is 20 seconds or 3 minutes, and short takes are probably the common case on a phone.

## Against CutAI

CutAI's site lists $19.99 a month for 100 edits, $49.99 for 300 and $89.99 for unlimited, in USD. An edit can be up to 15 minutes and 1 GB. The trial is 3 days with a card. The app is iPhone only.

That is $0.20 an edit on Starter and $0.17 on Pro, whatever the length. Yapper charges $0.30 for a short take and $0.70 for a 15 minute one on the monthly plan. On short takes the gap is small: 83 edits for $24.99 against 100 for $19.99. On long takes Yapper gives a third as many.

Yapper's plan also pays for ideas, scripts, captions and the Mac editor from the same balance, which CutAI does not have. The comparison a buyer will make first is still edits per month.

## What a "finished video" costs today

The top-up page says 100 credits is "part of a finished video". That line comes from `FINISHED_VIDEO_CREDITS` in `src/lib/billing/credit-equivalents.ts`, which adds up a script, six minutes of transcription, a 1-Click Edit, overlay planning, two designed overlays, a thumbnail and publish copy.

| Part                     | Credits | Cost at list | Model                         |
| ------------------------ | ------: | -----------: | ----------------------------- |
| Script from an idea      |       8 |       $0.035 | gpt-5.4                       |
| Transcription, 6 minutes |       8 |       $0.045 | Deepgram Nova-3               |
| 1-Click Edit cleanup     |       8 |       $0.003 | gemini-3.7-flash              |
| Publish copy             |       1 |       $0.009 | gpt-5.4-mini                  |
| Overlay planning         |      10 |       $0.120 | claude-opus-4.7               |
| Two designed overlays    |      60 |       $0.432 | claude-opus-4.7               |
| AI thumbnail             |      12 |       $0.277 | venice-gpt-image-2 on Surplus |
| Total                    |     107 |       $0.921 |                               |

The first four rows are the video itself: 25 credits and $0.09. Overlays and the thumbnail are the other 82 credits and 90% of the cost. The overlay figures are measured averages from 8 planning calls and 8 design calls.

So 100 credits falls short of one video because the definition includes two overlays designed by Opus, which is the most expensive thing Yapper does. A creator who scripts, records, cuts and posts spends 25 credits.

## Draft schedule

One cut costs 10 credits for any take up to 15 minutes. A longer take adds 10 for each further started 15 minutes, which only the Mac app and the web can reach if the phone caps recording at 15.

| Action               | Today                     | Draft                    | Cost at list     |
| -------------------- | ------------------------- | ------------------------ | ---------------- |
| Transcription        | 4 per started 3 minutes   | 8 per started 15 minutes | $0.0075 a minute |
| 1-Click Edit cleanup | 8 flat                    | 2 per started 15 minutes | $0.003 to $0.009 |
| One cut, total       | 12 to 28 up to 15 minutes | 10 up to 15 minutes      | $0.01 to $0.12   |
| Idea capture         | 1                         | 1                        | $0.009           |
| Script from an idea  | 8                         | 8                        | $0.035           |
| Publish copy         | 1                         | 1                        | under $0.009     |

Transcription carries 8 of the 10 credits because it carries nearly all of the cost.

| Raw footage | Credits today | Credits, draft | Our cost | Cost share, monthly | Cost share, yearly |
| ----------- | ------------: | -------------: | -------: | ------------------: | -----------------: |
| 1 minute    |            12 |             10 |    $0.01 |                  4% |                 6% |
| 3 minutes   |            12 |             10 |    $0.03 |                 10% |                15% |
| 5 minutes   |            16 |             10 |    $0.04 |                 16% |                24% |
| 10 minutes  |            24 |             10 |    $0.08 |                 32% |                48% |
| 15 minutes  |            28 |             10 |    $0.12 |                 48% |                72% |
| 30 minutes  |            48 |             20 |    $0.24 |                 48% |                72% |

A flat price means short takes pay for long ones. It holds as long as most takes are short. The six real runs on record would have cost 70 credits and $0.31 of provider spend, a cost share of 18% on monthly and 27% on yearly. The worst case is a yearly subscriber who only ever cuts 15 minute takes on a day when transcription needs its recovery passes and cleanup needs three attempts: that edit costs what it charges.

What the plan line becomes: 1,000 credits is 100 one-cut edits of up to 15 minutes each. CutAI's Starter is 100 edits of up to 15 minutes for $19.99.

A video from script to caption is 19 credits (script 8, one cut 10, publish copy 1), or 20 with idea capture. 100 credits covers 5 of them and the monthly plan covers 50. The top-up and plan pages should count this video. Overlays and thumbnails would be listed as extras with their own prices.

## Plan margin, and what Apple's cut does to it

One subscriber spending the whole allowance on one-cut edits. Storage and fixed costs are left out.

| Plan                   | Billing channel | Net revenue | Every take 5 minutes | Every take 15 minutes |
| ---------------------- | --------------- | ----------: | -------------------: | --------------------: |
| Monthly, $24.99        | Stripe          |      $23.79 |                  79% |                   47% |
| Monthly, $24.99        | Apple at 15%    |      $21.24 |                  69% |                   37% |
| Monthly, $24.99        | Apple at 30%    |      $17.49 |                  54% |                   22% |
| Yearly, $16.67 a month | Stripe          |      $16.04 |                  72% |                   24% |
| Yearly, $16.67 a month | Apple at 15%    |      $14.17 |                  61% |                   13% |
| Yearly, $16.67 a month | Apple at 30%    |      $11.67 |                  46% |                   -2% |

The 15 minute column is a ceiling, since nobody spends a whole allowance on maximum length takes. It shows how much of the flat price rests on transcription cost and on the billing channel.

## Where the cost can come down

Cleanup has nothing left to save. It costs $0.003 at list and $0.0006 settled on gemini-3.7-flash, about 7% of a 5 minute cut. Twenty models were tested against it and none that costs less cuts as well.

Transcription is the cost of a cut. `transcription-and-edit-eval-2026-11.md` tested the options on five real takes. Sending a take as one file is not one of them: Deepgram drops twice as many words that way, and the cut gets worse. Groq's whisper is not one either, because it drops a fifth of the words. Two options held up. Fifteen second pieces with two seconds of overlap matched the production pipeline's word count at 1.15 times the audio length, against at least 1.2 to 1.33 times today. And xAI's speech to text lists at $0.0017 a minute, 40% of Deepgram's price, with word times; its accuracy on those times is untested because Yapper has no xAI key.

Overlays are where a model change pays most. Overlay design averaged $0.216 a call on claude-opus-4.7, with about 7,700 output tokens that are almost all reasoning. At the same token counts the price table gives $0.15 on claude-sonnet-4.6, $0.14 on gpt-5.4, and about $0.04 on gpt-5.4-mini or gemini-3.7-flash. That is arithmetic on list prices. Whether a cheaper model designs an overlay worth keeping is untested. If one does, design could drop from 30 credits to under 10, and a video with two overlays would cost about half of today's 107.

The thumbnail runs on `venice-gpt-image-2` through Surplus. Over 35 calls it averaged $0.28 at list and $0.08 settled. Twelve credits are worth $0.30 on monthly and $0.20 on yearly, so at list the thumbnail loses money on the yearly plan.

## What could not be measured

There is no usage distribution to price against yet. `edit_runs` holds 6 runs from one account between October 16 and November 5. Their median was 4.4 minutes of footage, the longest was 17.7, and on average 64% of the footage was cut. That is one person's habits.

All 139 `$ai_generation` events in PostHog carry `environment: development`. No production AI call has been logged since the telemetry shipped on October 30.

Deepgram calls are not in that telemetry, because it only covers Chat Completions. The transcription cost above is computed from list price and the chunk plan, and has not been checked against a Deepgram invoice.

A second read-only query, credit deductions by action, was blocked by the session's permission check, so real spend per action is not in this document.

## Two things the telemetry showed outside mobile

Chirpy action planning charges 2 credits. Across 81 calls on gpt-5.4 it averaged $0.052 at list, with a 95th percentile of $0.081. Two credits are worth $0.05 on monthly and $0.033 on yearly, so the action loses money at list price on the yearly plan. Settled cost through Surplus averaged $0.020.

The `chirpy_studio_turn` events on claude-haiku-5.5 report $0.088 at list for about 7,200 input tokens. claude-haiku-5.5 has no row in `src/lib/costs/model-prices.ts`, so it is priced at the unknown-model rate of $10 and $50 per million tokens. The provider budget reserves against the same table, so each of those calls also claims more of the daily ceiling than it should.

## Decisions this needs

1. Whether iPhone uses the same Creator membership and credit balance as the Mac app and the web. This draft assumes it does.
2. Whether one cut is 10 credits flat up to 15 minutes, on every client.
3. Whether "finished video" on the pricing pages means script to caption, with overlays and thumbnails shown as extras.
4. Whether the phone caps a take at 15 minutes. The flat price depends on a cap. The server accepts up to 60.
5. Which cost work to run first: the overlay model eval, single-file transcription, or the Groq accuracy eval.
6. Whether $24.99 stays the monthly price next to CutAI's $19.99.
7. Where billing happens, Apple or the web.
