# Unit economics and pricing

Last verified: 2026-09-03. Supersedes the money map in `product-vision.md` §4,
which predates the Brain, the native editor, Poster, and the current plan
catalog. Storage rates and accounting rules stay in `storage-economics.md`.

This is a planning document. Every dollar figure below is derived from list
prices and from the prompt caps in the code, not from measured bills, because
the app does not record token usage or provider cost anywhere yet (§9). Treat
the numbers as good to about 30% and replace them once measurement lands.

## 1. Summary

The credit ladder was designed around cheap text generation and it prices those
actions well: a hook, an idea, a caption or a Brain reply costs us well under a
cent and sells for 5 to 8 cents. Four things break the model.

Transcription and video coaching cost us in proportion to clip length, but the
ladder charges a flat credit. A one hour take costs about 34 cents of Deepgram
time and sells for one credit, which is 3.3 cents on the yearly plan. Poster then
transcribes the finished export a second time for another credit, and the native
editor's 30 second chunk overlap bills about 1.33 times the real audio.

Two fixed price actions run at or below cost. The AI thumbnail renders a 2K
image for 10.1 cents and sells for two credits (6.6 to 10 cents depending on
plan). Creator feed analysis runs an Apify scrape for roughly 12 cents and sells
for four credits (13 to 32 cents), which is fine on weekly and thin on yearly.

The yearly plan hands out 6,000 credits on day one of a seven day trial, and the
webhook appears to grant the plan allotment a second time when the trial
converts. Credits never expire, so that liability rolls forward indefinitely.

The three top up packs price a credit at 9, 6.3 and 4.9 cents. The largest pack
sells credits cheaper than the monthly plan does, so a subscriber's best move is
the smallest plan plus 1,000 credit packs.

None of this is hard to fix. The recommended changes (§7 and §8) keep the
current prices and the single Creator membership, make the two duration heavy
actions scale with minutes, reprice thumbnails and creator analysis, cap the
trial grant, and add the one table we need to measure real cost per call.

## 2. Where the money goes

Every external provider the app pays, with the list rate used in this document.
Surplus is a market for OpenAI compatible inference and typically clears below
list (the vendor claims about 38% off). Costs here use list, so Surplus savings
are upside.

| Provider                               | Used for                                                                                                   | Rate used here                                                                                                                                                     | Where in code                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Deepgram Nova-3 (batch, pay as you go) | Editor transcription, feedback meters, Poster, saved Reel transcripts                                      | $0.0043 per audio minute, plus $0.0013 per minute when keyterms are sent (dictionary users)                                                                        | `src/lib/transcription/providers.ts`, `src/lib/feedback/transcribe.ts`     |
| Groq whisper-large-v3                  | Transcription failover only                                                                                | $0.111 per audio hour ($0.00185 per minute)                                                                                                                        | `src/app/api/transcribe/route.ts`                                          |
| gpt-5.4-mini via Surplus               | Ideas, hooks, scripts, captions, Brain router and chat, capture, spin, ingest, coaching, overlay placement | $0.75 in, $4.50 out per 1M tokens (cached input $0.075)                                                                                                            | `GENERATE_MODEL`, `FEEDBACK_MODEL`, `AI_PLACE_MODEL`, `BRAIN_ROUTER_MODEL` |
| gpt-5.4 via Surplus                    | Idea expansion, web resource summaries                                                                     | $2.50 in, $15.00 out per 1M tokens                                                                                                                                 | `src/lib/ideas/expand.ts`, `src/lib/inspiration/web-resource.ts`           |
| gemini-3.1-pro (preview) via Surplus   | 1-Click Edit retake cleanup                                                                                | $2.00 in, $12.00 out per 1M tokens                                                                                                                                 | `AI_CLEAN_MODEL` in `src/app/api/clean-transcript/route.ts`                |
| gemini-flash-latest (Google direct)    | Video and full coaching. Alias currently resolves to the 3.8 Flash generation                              | $0.75 in, $3.75 out per 1M tokens through Dec 2026 (doubles in 2027). Video is about 100 tokens per second at default resolution plus about 30 per second of audio | `GEMINI_VIDEO_MODEL` in `src/lib/feedback/gemini.ts`                       |
| gemini-3.1-flash-image (Google direct) | AI thumbnails at 2K                                                                                        | $0.101 per 2K image, $0.067 per 1K, $0.045 per 512px. The Lite variant is $0.034 per 1K                                                                            | `GEMINI_IMAGE_MODEL` in `src/lib/publish/thumbnail.ts`                     |
| Apify                                  | Instagram and TikTok media resolution, creator feeds                                                       | About $1.50 to $2.60 per 1,000 results plus actor runtime. The code comment estimates $0.12 per creator feed                                                       | `src/lib/inspiration/apify.ts`                                             |
| Jina Reader                            | Web resource text extraction                                                                               | Negligible (token budget 16k per call)                                                                                                                             | `src/lib/inspiration/web-resource.ts`                                      |
| Cloudflare R2                          | Finished exports, imported masters, transient transcription audio                                          | $0.015 per GB-month, $4.50 per 1M writes, zero egress                                                                                                              | `src/lib/r2.ts`                                                            |
| Neon Postgres (Launch)                 | Everything relational                                                                                      | $5 per month minimum, $0.106 per CU-hour, $0.35 per GB-month                                                                                                       | `src/lib/db`                                                               |
| Vercel Pro                             | Hosting, API routes, cron                                                                                  | $20 per seat, $0.128 per active CPU hour, $0.0106 per GB-hour memory, $0.60 per 1M invocations                                                                     | `vercel.json`, route `maxDuration` values                                  |
| Clerk                                  | Auth                                                                                                       | Free to 50,000 monthly retained users, then $100 per month plus $0.02 per user                                                                                     | every route                                                                |
| Stripe                                 | Subscriptions and packs                                                                                    | 2.9% plus $0.30 per charge, plus 0.7% Billing fee on recurring volume                                                                                              | `src/lib/stripe.ts`                                                        |
| Resend, PostHog                        | Waitlist email, web analytics                                                                              | Free tiers (3,000 emails, 1M events per month)                                                                                                                     | `src/app/api/waitlist/route.ts`                                            |

Things that cost nothing because they run on the creator's machine: silence
detection, waveform, thumbnails, face detection, person matting, captions and
gap fill, compositing and export, sound effects (19 bundled files, 1.1 MB). The
native app never uploads source media. The only bytes that leave the Mac are
AAC transcription chunks (deleted after transcription) and the final export sent
to Poster.

### Fixed monthly floor

| Item                                   | Monthly          |
| -------------------------------------- | ---------------- |
| Vercel Pro seat                        | $20              |
| Neon Launch (minimum, scale to zero)   | $5 to $20        |
| Apple Developer Program                | $8.25            |
| Domain                                 | about $1.50      |
| Clerk, Resend, PostHog, R2 first 10 GB | $0               |
| Total before any usage                 | about $35 to $50 |

Two monthly subscribers cover the floor. Vercel function time is not a real
cost at this scale: a three minute video coaching run holds a function for
about 90 seconds and costs under a tenth of a cent.

### Payment fees by plan

| Plan    | Charge  | Stripe fee per charge | Fee per month        | Fee share |
| ------- | ------- | --------------------- | -------------------- | --------- |
| Weekly  | $7.99   | $0.59                 | $2.55 (4.33 charges) | 7.4%      |
| Monthly | $24.99  | $1.20                 | $1.20                | 4.8%      |
| Yearly  | $199.99 | $7.50                 | $0.63                | 3.8%      |

The weekly plan's 30 cent fixed fee is the reason it should stay the most
expensive per credit.

## 3. What each action costs us

Assumptions: a typical talking head take is 3 minutes (about 450 words) and a
long one is 15 minutes. Token counts come from the prompt caps in the code and
the transcript sizes those takes produce. "Worst" is the cap in the code, not a
guess about model behaviour.

Credit revenue per plan: weekly $0.080, monthly $0.050, yearly $0.033. The
"COGS share" column uses the monthly plan.

| Action                                   | Credits today | Provider calls per action                     | COGS, 3 min take   | COGS, 15 min take           | Worst case in code                                                 | COGS share (monthly) |
| ---------------------------------------- | ------------- | --------------------------------------------- | ------------------ | --------------------------- | ------------------------------------------------------------------ | -------------------- |
| Transcribe (native, chunked)             | 1             | 1 Deepgram call per 120 s chunk, 30 s overlap | $0.015             | $0.086                      | $0.34 for a 60 min take, ×2 on Groq failover, ×1.3 with dictionary | 30% to 170%          |
| Transcribe (browser, direct body)        | 1             | 1                                             | $0.013             | n/a (4 MB cap, about 8 min) | $0.035                                                             | 26%                  |
| Poster re-transcription of the export    | 1             | 1 (Deepgram by URL)                           | $0.013             | $0.065                      | $0.26                                                              | 26% to 130%          |
| 1-Click Edit cleanup                     | 1             | 1, up to 3 on transient failure               | $0.013             | $0.042                      | $0.30 (3 attempts, 16k output tokens)                              | 26% to 84%           |
| Overlay placement                        | 1             | 1                                             | $0.008             | $0.010                      | $0.02                                                              | 16%                  |
| Audio coaching                           | 3             | Deepgram + 1 mini pass                        | $0.019             | $0.03                       | $0.04                                                              | 13%                  |
| Video coaching                           | 5             | Files upload + 1 Gemini pass                  | $0.025             | $0.094                      | $0.25 for a 250 MB clip                                            | 10% to 38%           |
| Full coaching                            | 8             | above + Deepgram                              | $0.037             | $0.16                       | $0.30                                                              | 9% to 40%            |
| Training feedback (welcome grant)        | 3             | Deepgram + 2 mini passes                      | $0.022 (2 min rep) | n/a (10 min cap)            | $0.06                                                              | 15%                  |
| Idea                                     | 2             | router + 1 mini pass                          | $0.009             |                             | $0.015                                                             | 9%                   |
| Script                                   | 3             | router + 1 mini pass                          | $0.007             |                             | $0.01                                                              | 5%                   |
| Hooks                                    | 1             | router + 1 mini pass                          | $0.006             |                             | $0.01                                                              | 12%                  |
| Brain chat (Chirpy)                      | 1             | router + 1 mini pass, 12 turns of history     | $0.009             |                             | $0.02 (48k chars of history)                                       | 18% to 40%           |
| Brain spin                               | 1             | router + 1 mini pass                          | $0.005             |                             | $0.008                                                             | 10%                  |
| Brain ingest                             | 1             | 1 mini pass on 20 sample rows                 | $0.002             |                             | $0.003                                                             | 4%                   |
| Idea capture                             | 1             | 1 mini pass                                   | $0.003             |                             | $0.005                                                             | 6%                   |
| Brainstorm                               | 1             | router + 1 mini pass                          | $0.009             |                             | $0.02                                                              | 18%                  |
| Idea expansion                           | 2             | router + 1 gpt-5.4 pass, up to 40k chars      | $0.035             |                             | $0.07                                                              | 35% to 70%           |
| Publish copy (all platforms in one call) | 1             | router + 1 mini pass                          | $0.009             |                             | $0.015                                                             | 18%                  |
| AI thumbnail (2K)                        | 2             | 1 image call                                  | $0.103             |                             | $0.11                                                              | 103%                 |
| Reference analysis, YouTube              | 2             | 0 paid calls (page scrape)                    | $0.00              |                             |                                                                    | 0%                   |
| Reference analysis, Instagram or TikTok  | 2             | Apify + Deepgram                              | $0.025             |                             | $0.05                                                              | 25%                  |
| Reference analysis, web page             | 2             | Jina + 1 gpt-5.4 pass on 50k chars            | $0.045             |                             | $0.06                                                              | 45%                  |
| Creator feed, YouTube                    | 4             | 0 paid calls (Data API on the user's token)   | $0.00              |                             |                                                                    | 0%                   |
| Creator feed, Instagram or TikTok        | 4             | 1 Apify run, 24 items                         | $0.12              |                             | unbounded (no timeout or byte cap)                                 | 60%                  |

Free actions that still cost us something: Instagram import streams up to 250 MB
through a function and stores the master in R2; publishing spools up to 4 GB to
a temp file; every native tab switch is a server rendered page load; the
signed out native app polls Clerk every two seconds.

## 4. Monthly cost per creator

Three usage shapes, each on the actions above. Storage is the incremental R2
cost for what that creator adds per month.

|                                          | Light: 4 posts, 3 min takes | Regular: 12 posts, 5 min takes    | Heavy: 30 posts, 15 min takes      |
| ---------------------------------------- | --------------------------- | --------------------------------- | ---------------------------------- |
| Posts (transcribe + cleanup + Poster)    | $0.16                       | $0.84                             | $5.79                              |
| Coaching                                 | none                        | 6 audio, $0.17                    | 10 video, $0.94                    |
| Publish copy and thumbnails              | 4 captions, $0.04           | 12 captions + 4 thumbnails, $0.52 | 30 captions + 15 thumbnails, $1.82 |
| Ideas, hooks, expansion                  | $0.04                       | $0.28                             | $0.60                              |
| Brain chat                               | none                        | 20 turns, $0.18                   | 60 turns, $0.54                    |
| Inspiration (creator feeds + references) | none                        | 2 + 6, $0.39                      | 4 + 15, $0.86                      |
| AI and provider COGS                     | $0.24                       | $2.38                             | $10.55                             |
| Credits consumed under today's ladder    | 24                          | 150                               | 382                                |
| New video stored per month               | 0.6 GB                      | 3 GB                              | 22 GB                              |

Gross margin per plan, after Stripe fees, after R2 for a full allowance, before
the fixed floor:

| Plan (monthly equivalent revenue) | Light | Regular | Heavy |
| --------------------------------- | ----- | ------- | ----- |
| Weekly ($34.62)                   | 92%   | 85%     | 61%   |
| Monthly ($24.99)                  | 94%   | 84%     | 50%   |
| Yearly ($16.67)                   | 93%   | 79%     | 24%   |

The heavy creator on the yearly plan is the problem case. They use 382 credits
a month against a 500 credit monthly allotment, so they never buy a pack, and
their long takes and thumbnails eat three quarters of the revenue. Under the
duration based schedule in §7 that creator would consume about 700 credits a
month, cross the allotment, and either buy packs or slow down. Either outcome
restores margin.

At a plausible mix of 60% light, 30% regular and 10% heavy, blended AI COGS on
the monthly plan is about $1.90 per subscriber, under 8% of revenue. The
business is healthy on average. The fixes are about removing the tails.

## 5. Competitive reference

| Product    | Price                                                                                            | What the meter is                                               |
| ---------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Captions   | $9.99 Basic (200 credits), $24.99 Max (500 credits), $69.99+ Scale                               | Credits per generative feature, rollover capped at 3× allotment |
| Descript   | $24 Hobbyist (10 media hours, 400 AI credits), $35 Creator (30 hours, 800 credits), $65 Business | Two meters: media minutes and AI credits                        |
| Opus Clip  | $15 Starter (150 credits), $29 Pro (300 credits)                                                 | 1 credit per minute of source footage                           |
| Submagic   | $19 Starter (15 videos, 2 min each), $39 Pro (40 videos, 5 min each)                             | Videos per month with a length cap                              |
| Riverside  | $14 Pro, $19 Grow monthly                                                                        | Recording hours, transcription unlimited                        |
| CapCut Pro | $19.99 per month, $179.99 per year                                                               | Feature unlock, no meter                                        |

Yapper's monthly plan at $24.99 for 500 credits matches Captions Max exactly.
Descript, Opus and Submagic all meter by minutes of footage, which is the
model §7 recommends for the two actions where our cost is per minute.

## 6. Problems found in the current implementation

1. Transcription is priced per call, billed per minute. The native app splits
   a take into 120 second chunks with 30 second overlaps, so Deepgram hears
   about 1.33 times the real audio, and a 60 minute take fans out 40 parallel
   calls for one credit. `AIEditService.swift` lines 176 to 178,
   `src/app/api/transcribe/route.ts` lines 224 to 233.
2. Poster transcribes the finished export again even though the editor already
   holds the words and the cut list. `PosterHandoffService.swift` line 91. That
   is a second credit and a second Deepgram bill on every post.
3. The 2K thumbnail costs more than the two credits it sells for on every plan.
4. Idea expansion and web resource summaries default to gpt-5.4, three to four
   times the price of the mini model used everywhere else, on the largest
   prompts in the app (40k and 50k characters). `src/lib/ideas/expand.ts`
   line 38, `src/lib/inspiration/web-resource.ts` line 161.
5. Cleanup allows 16,000 output tokens and three attempts on gemini-3.1-pro.
   The measured production take needed under 1,000 tokens, so the cap is a
   runaway guard that costs nothing normally but allows a 30 cent call.
6. Checkout grants the full plan allotment when a trial starts, and the
   `invoice.paid` handler grants again on `subscription_cycle`. The trial to
   paid transition is a new billing period, so the first paid month very likely
   grants twice. Verify in Stripe test mode. `src/app/api/stripe/webhook/route.ts`
   lines 72 to 85 and 133 to 152.
7. A yearly trialist receives 6,000 credits on day one. The only brake is the
   400 actions per day umbrella limit, which still allows several hundred
   dollars of Apify and Deepgram spend across a seven day trial.
8. Credits accumulate forever. There is no distinction between plan credits and
   purchased credits, so no expiry or rollover cap can be added without a schema
   change.
9. The 1,000 credit pack ($0.049 per credit) undercuts the monthly plan ($0.050)
   and the packs never expire.
10. The generate routes charge after delivery and return the result free if the
    deduction fails for any reason other than insufficient balance.
    `src/app/api/generate/idea/route.ts` lines 93 to 95 and the same pattern in
    script and hooks.
11. The paywall gate returns true whenever Stripe is not configured, so losing
    the Stripe env vars in production silently makes every AI action credit only.
    `src/lib/billing/gate.ts` line 14.
12. Nothing records token usage or provider cost. No response's `usage` or
    `usageMetadata` field is read anywhere in `src/`.
13. Smaller items: the capture and brainstorm route docstrings say "no credits"
    but both reserve one; the pricing cards still list speaking exam features
    and describe the allotment as "AI feedbacks" using the training feedback
    price; `.env.local` uses the old STARTER/PRO/PLUS price variable names while
    `plans.ts` reads CREATOR_WEEKLY/MONTHLY/YEARLY and CREDITS_100/300/1000, so
    confirm the Vercel production env has the new names; Apify calls have no
    timeout or byte bound; the upload-url route consumes the transcribe rate
    limit bucket once per chunk, so a 15 minute take burns 10 of 12 tokens
    before the transcription itself.

## 7. Recommended credit schedule

Principle: a credit should cost us at most about 1.25 cents on average so that
the cheapest plan (yearly, 3.3 cents per credit) still clears 60% on every
action, and text actions stay generous because they are what people repeat.

| Action                                        | Today   | Proposed                                                    | Notes                                                                                                         |
| --------------------------------------------- | ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Transcribe                                    | 1       | 1 per started 5 minutes                                     | 3 min = 1, 15 min = 3, 60 min = 12. The server already knows chunk durations. Show the price before the call. |
| 1-Click Edit cleanup                          | 1       | 1 per started 5 minutes                                     | Same schedule, same preflight message. Lower the output cap to 4,000 tokens.                                  |
| Poster transcription                          | 1       | 0                                                           | Reuse the editor transcript and cut list. Charge the transcribe schedule only when no transcript exists.      |
| Audio coaching                                | 3       | 3 up to 5 minutes, then 1 per extra 5                       |                                                                                                               |
| Video coaching                                | 5       | 5 up to 3 minutes, then 2 per extra 3                       | Send `mediaResolution: low` and 1 fps explicitly.                                                             |
| Full coaching                                 | 8       | 8 up to 3 minutes, then 3 per extra 3                       |                                                                                                               |
| Training feedback                             | 3       | 3                                                           | Keep equal to the welcome grant.                                                                              |
| Idea, script, hooks                           | 2, 3, 1 | 2, 2, 1                                                     | Script costs us less than idea. Optional.                                                                     |
| Brain chat, spin, capture, brainstorm, ingest | 1 each  | 1 each                                                      | Trim chat history to 8 turns of 2,000 chars.                                                                  |
| Idea expansion                                | 2       | 2 on gpt-5.4-mini                                           | If quality needs gpt-5.4, charge 4.                                                                           |
| Publish copy                                  | 1       | 1                                                           |                                                                                                               |
| AI thumbnail                                  | 2       | 2 at 1K on the Lite image model, 4 for 2K on the full model | Lite at 1K costs $0.034.                                                                                      |
| Reference analysis                            | 2       | 1 for YouTube, 2 for Instagram, TikTok and web pages        | Web page summaries move to the mini model.                                                                    |
| Creator feed                                  | 4       | 2 for YouTube, 6 for Instagram and TikTok                   | YouTube is free through the Data API.                                                                         |

Under this schedule the heavy creator from §4 spends about 560 credits a month
and costs about $6.70 (the overlap fix, Poster reuse and the Lite thumbnail
remove most of the waste). On the monthly plan that creator now buys a pack or
slows down, and margin lands near 70% either way. The regular creator spends
about 155 credits and costs about $1.70. The light creator is unchanged.

## 8. Recommended plans and rules

Keep the single Creator membership and the three prices. Change how credits are
delivered.

| Plan    | Price            | Credits                          | Storage | Change                                                                                                                                                                |
| ------- | ---------------- | -------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly  | $7.99 per week   | 100 per week                     | 25 GB   | None. The fee drag makes this the right most expensive per credit tier.                                                                                               |
| Monthly | $24.99 per month | 500 per month                    | 50 GB   | None.                                                                                                                                                                 |
| Yearly  | $199.99 per year | 500 per month, delivered monthly | 100 GB  | Stop granting 6,000 up front. A daily cron grants 500 on each monthly anniversary of the period start. Optionally 1,000 on the first payment as the commitment bonus. |

Trial: grant 100 credits at trial start, not the plan allotment. The existing
`subscription_cycle` grant delivers the full allotment on the first payment.
This also removes the double grant in §6 item 6.

Rollover: plan credits roll over up to twice the monthly allotment (1,000 on
monthly). Purchased pack credits never expire. This needs two balances, or a
`bucket` column on the ledger with the deduction order pack last.

Packs, subscriber only, priced above the plan's per credit rate so they stay a
top up and not a substitute:

| Pack  | Today | Proposed | Per credit |
| ----- | ----- | -------- | ---------- |
| 100   | $9    | $9       | $0.090     |
| 300   | $19   | $24      | $0.080     |
| 1,000 | $49   | $69      | $0.069     |

If you would rather keep $19 and $49, reduce the packs to 240 and 700 credits.

An alternative worth knowing about but not recommended now: a two tier
structure (Creator $19.99 for 300 credits and 25 GB, Pro $39.99 for 900 credits
and 100 GB). It sells better to heavy users and matches Descript's shape, but
it reopens the "which features are on which tier" question that the single
membership was chosen to avoid, and the per credit economics above already fix
the margin problem without it.

## 9. Engineering changes, in order of dollar impact

1. Reuse the editor transcript in Poster instead of re-transcribing the export.
2. Send the native take to Deepgram as one file by URL, or cut the chunk
   overlap from 30 seconds to 5. Either removes the 33% overspend.
3. Duration based credit pricing for transcribe, cleanup and coaching, with a
   preflight response that tells the client the price before it uploads.
4. Trial grant cap, yearly monthly drip, and a test that the trial to paid
   transition grants exactly once.
5. Thumbnail: Lite model at 1K by default, 2K as a 4 credit option.
6. Idea expansion and web resource summary on gpt-5.4-mini.
7. Cleanup output cap to 4,000 tokens.
8. Gemini video: explicit low media resolution and 1 fps.
9. Two credit buckets with rollover cap and pack expiry rules.
10. Move the generate and feedback routes onto the reserve then refund helper so
    every paid action shares one billing protocol and nothing ships free on a
    database error.
11. Fail closed on the paywall in production when Stripe is unconfigured.
12. Fix the pricing card copy, the two docstrings, the env var names, the
    upload-url rate bucket, and add a timeout and byte cap to Apify calls.

## 10. Measurement

Add a `provider_usage` table and write one row per provider call:

| Column                                           | Purpose                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `usage_id`                                       | Joins to the credit ledger row that paid for it                                            |
| `action`, `route`                                | Which paid action and endpoint                                                             |
| `provider`, `model`                              | As sent                                                                                    |
| `input_tokens`, `output_tokens`, `cached_tokens` | From the response `usage` or `usageMetadata` object                                        |
| `media_seconds`                                  | Audio or video seconds billed (Deepgram `metadata.duration`, chunk durations, clip length) |
| `est_cost_usd`                                   | Computed at write time from a rates table so historical rows keep their price              |
| `latency_ms`, `attempt`, `ok`                    | Retries and failures cost money too                                                        |

With that in place a weekly query gives real COGS per action, per plan, and
per creator, and the schedule in §7 can be tuned on data. The speaking coach
project already emits `surplus_cost_settled` and `$ai_generation` to PostHog;
Yapper should do the same from the same helper so both products share one cost
dashboard.

## 11. Assumptions and open questions

Token counts are estimated at four characters per token from the prompt caps
and typical transcript sizes. Apify per run cost is taken from the code's own
$0.12 per creator estimate and public per result prices; actor runtime charges
vary. The `gemini-flash-latest` alias is assumed to resolve to the 3.8 Flash
generation; if it still points at 2.5 Flash the video numbers are about 15%
lower. Surplus clearing prices are not modelled. Persona mixes are guesses
until PostHog or the ledger says otherwise.

Open decisions: whether the yearly commitment bonus is worth the complexity;
whether to keep the weekly plan at 25 GB given lapsed weekly users leave that
much behind; whether Chirpy on non editor tabs should cost a credit at all
(it costs under a cent and is the surface most likely to build habit).

## 12. Sources

Provider prices checked 2026-09-02 and 2026-09-03:
[Deepgram pricing](https://deepgram.com/pricing),
[Groq pricing](https://www.eesel.ai/blog/groq-pricing),
[Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing),
[Gemini video tokens](https://ai.google.dev/gemini-api/docs/video-understanding),
[gpt-5.4-mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[OpenAI pricing](https://developers.openai.com/api/docs/pricing),
[Surplus Intelligence](https://www.surplusintelligence.ai/),
[Apify Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper),
[Vercel Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing),
[Neon pricing](https://vela.run/articles/neon-serverless-postgres-pricing-2026/),
[Clerk pricing](https://clerk.com/articles/clerk-pricing-explained),
[Stripe fees](https://checkoutpage.com/blog/stripe-processing-fees),
[Resend pricing](https://flexprice.io/blog/detailed-resend-pricing-guide),
[PostHog pricing](https://flexprice.io/blog/posthog-pricing-guide).

Competitors: [Captions](https://cutsnap.ai/blog/captions-ai-pricing-2026),
[Descript](https://sonix.ai/resources/descript-pricing/),
[Opus Clip](https://www.eesel.ai/blog/opusclip-pricing),
[Submagic](https://cutsnap.ai/blog/submagic-pricing-2026),
[Riverside](https://comparedge.com/tools/riverside/pricing),
[CapCut](https://socialrails.com/blog/capcut-pricing-guide).
