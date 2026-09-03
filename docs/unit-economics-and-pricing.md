# Unit economics and pricing

Last verified: 2026-09-03. Supersedes the money map in `product-vision.md` §4,
which predates the Brain, the native editor, Poster, and the current plan
catalog. Storage rates and accounting rules stay in `storage-economics.md`. The
1-Click Edit model comparison is reviewed in `one-click-benchmark-review.md`.

Pricing basis, decided 2026-09-03: credits are priced against provider list
prices, not against what Surplus currently settles at. The Surplus discount is
real (§2b) but it is a market rate that can close, so it counts as margin
buffer, never as the number the credit ladder is built on. Every cost figure in
§3, §4 and §7 is therefore a list price figure. The app records no token usage
or cost per call (§10), so per action numbers are still estimates, good to
about 30%.

## 1. Summary

The credit ladder was designed around cheap text generation and it prices those
actions well: a hook, an idea, a caption or a Brain reply costs well under a
cent at list and sells for 5 to 8 cents. Four things break the model.

Transcription and video coaching cost in proportion to clip length, but the
ladder charges a flat credit. A one hour take costs about 34 cents of Deepgram
time and sells for one credit, which is 3.3 cents on the yearly plan. Poster
then transcribes the finished export a second time for another credit, and the
native editor's 30 second chunk overlap bills about 1.33 times the real audio.

Two fixed price actions run at or below cost. The AI thumbnail renders a 2K
image on Google direct for 10.1 cents and sells for two credits (6.6 to 10
cents). Creator feed analysis runs an Apify scrape for roughly 12 cents and
sells for four credits, fine on weekly and thin on yearly.

The yearly plan hands out 6,000 credits on day one of a seven day trial, and the
webhook appears to grant the allotment a second time when the trial converts.
Credits never expire.

The 1,000 credit pack sells credits cheaper than the monthly plan does.

The fixes in §7 and §8 keep the current prices and the single Creator
membership. They make transcription and coaching scale with minutes, stop the
Poster re-transcription, rebuild the thumbnail step around a frame the creator
already picks, cap the trial grant, and add the measurement we need.

## 2. Where the money goes

### 2a. List rates (the pricing basis)

| Provider                               | Used for                                                                                                   | Rate used here                                                                                                                                                     | Where in code                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Deepgram Nova-3 (batch, pay as you go) | Editor transcription, feedback meters, Poster, saved Reel transcripts                                      | $0.0043 per audio minute, plus $0.0013 per minute when keyterms are sent (dictionary users)                                                                        | `src/lib/transcription/providers.ts`, `src/lib/feedback/transcribe.ts`     |
| Groq whisper-large-v3                  | Transcription failover only                                                                                | $0.111 per audio hour                                                                                                                                              | `src/app/api/transcribe/route.ts`                                          |
| gpt-5.4-mini via Surplus               | Ideas, hooks, scripts, captions, Brain router and chat, capture, spin, ingest, coaching, overlay placement | $0.75 in, $4.50 out per 1M tokens                                                                                                                                  | `GENERATE_MODEL`, `FEEDBACK_MODEL`, `AI_PLACE_MODEL`, `BRAIN_ROUTER_MODEL` |
| gpt-5.4 via Surplus                    | Idea expansion, web resource summaries                                                                     | $2.50 in, $15.00 out per 1M tokens                                                                                                                                 | `src/lib/ideas/expand.ts`, `src/lib/inspiration/web-resource.ts`           |
| gemini-3.1-pro via Surplus             | 1-Click Edit retake cleanup                                                                                | $2.00 in, $12.00 out per 1M tokens                                                                                                                                 | `AI_CLEAN_MODEL` in `src/app/api/clean-transcript/route.ts`                |
| gemini-flash-latest (Google direct)    | Video and full coaching. Alias currently resolves to the 3.8 Flash generation                              | $0.75 in, $3.75 out per 1M tokens through Dec 2026 (doubles in 2027). Video is about 100 tokens per second at default resolution plus about 30 per second of audio | `GEMINI_VIDEO_MODEL` in `src/lib/feedback/gemini.ts`                       |
| gemini-3.1-flash-image (Google direct) | AI thumbnails at 2K                                                                                        | $0.101 per 2K image, $0.067 per 1K, $0.045 per 512px. The Lite variant is $0.034 per 1K                                                                            | `GEMINI_IMAGE_MODEL` in `src/lib/publish/thumbnail.ts`                     |
| Apify                                  | Instagram and TikTok media resolution, creator feeds                                                       | About $1.50 to $2.60 per 1,000 results plus actor runtime. The code comment estimates $0.12 per creator feed                                                       | `src/lib/inspiration/apify.ts`                                             |
| Jina Reader                            | Web resource text extraction                                                                               | Negligible                                                                                                                                                         | `src/lib/inspiration/web-resource.ts`                                      |
| Cloudflare R2                          | Finished exports, imported masters, transient transcription audio                                          | $0.015 per GB-month, $4.50 per 1M writes, zero egress                                                                                                              | `src/lib/r2.ts`                                                            |
| Neon Postgres (Launch)                 | Everything relational                                                                                      | $5 per month minimum, $0.106 per CU-hour, $0.35 per GB-month                                                                                                       | `src/lib/db`                                                               |
| Vercel Pro                             | Hosting, API routes, cron                                                                                  | $20 per seat, $0.128 per active CPU hour, $0.0106 per GB-hour memory, $0.60 per 1M invocations                                                                     | `vercel.json`                                                              |
| Clerk                                  | Auth                                                                                                       | Free to 50,000 monthly retained users                                                                                                                              | every route                                                                |
| Stripe                                 | Subscriptions and packs                                                                                    | 2.9% plus $0.30 per charge, plus 0.7% Billing fee on recurring volume                                                                                              | `src/lib/stripe.ts`                                                        |
| Resend, PostHog                        | Waitlist email, web analytics                                                                              | Free tiers                                                                                                                                                         | `src/app/api/waitlist/route.ts`                                            |

Things that cost nothing because they run on the creator's machine: silence
detection, waveform, thumbnails, face detection, person matting, captions and
gap fill, compositing and export, sound effects (19 bundled files, 1.1 MB). The
native app never uploads source media. The only bytes that leave the Mac are
AAC transcription chunks (deleted after transcription) and the final export sent
to Poster.

### 2b. What Surplus actually charges (margin buffer, not pricing basis)

Surplus is an order book for inference. Its `/v1/models` catalog shows the
provider's list price; the buyer is charged what the market clears at, visible
afterwards in `GET /v1/buyer/me`. Measured on the production key on 2026-09-03:

| Model                        | Lifetime requests | Lifetime discount vs list | Settled per request (lifetime avg)          | Last 60 days discount (PostHog) |
| ---------------------------- | ----------------- | ------------------------- | ------------------------------------------- | ------------------------------- |
| gpt-5.4-mini                 | 2,726             | 78%                       | $0.0017                                     | 98.7%                           |
| gpt-5.4                      | 283               | 63%                       | $0.0057                                     | 97.5%                           |
| gemini-3.1-pro               | 98                | 64%                       | $0.0218 (4.0k in, 4.4k out incl. reasoning) | 97.8%                           |
| gemini-3.7-flash             | 30                | 75%                       | $0.0092                                     | 61%                             |
| gpt-5.5                      | 5,596             | 96%                       | $0.0051                                     | 99.1%                           |
| venice-nano-banana-2 (image) | 3                 | 90%                       | $0.0062 per image                           | n/a                             |

The discount moves by model and by week (Gemini 3.7 Flash cleared at 39% of
list recently, gpt-5.4-mini at about 1%). At today's rates the Surplus share of
a creator's COGS is about a twentieth of the list figure. Plan on list; enjoy
the difference.

The production key is shared with the speaking coach, which is why the
lifetime table above mixes both products. Decision 2026-09-03: each product
gets its own Surplus key so `/v1/buyer/me` and the settled cost events report
per product. Yapper's `SURPLUS_API_KEY` in Vercel should be a new key, and the
speaking coach keeps the current one.

### 2c. Fixed monthly floor

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

### 2d. Payment fees by plan

| Plan    | Charge  | Stripe fee per charge | Fee per month        | Fee share |
| ------- | ------- | --------------------- | -------------------- | --------- |
| Weekly  | $7.99   | $0.59                 | $2.55 (4.33 charges) | 7.4%      |
| Monthly | $24.99  | $1.20                 | $1.20                | 4.8%      |
| Yearly  | $199.99 | $7.50                 | $0.63                | 3.8%      |

The weekly plan's 30 cent fixed fee is the reason it should stay the most
expensive per credit.

## 3. What each action costs us at list

Assumptions: a typical talking head take is 3 minutes (about 450 words) and a
long one is 15 minutes. Token counts come from the prompt caps in the code and
the transcript sizes those takes produce; where the account has measured
output (cleanup: 4,400 output tokens per call), the measured figure is used.
"Worst" is the cap in the code.

Credit revenue per plan: weekly $0.080, monthly $0.050, yearly $0.033. The
"COGS share" column uses the monthly plan.

| Action                                                | Credits today | Provider calls per action                     | COGS, 3 min take                 | COGS, 15 min take           | Worst case in code                                                 | COGS share (monthly) |
| ----------------------------------------------------- | ------------- | --------------------------------------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------ | -------------------- |
| Transcribe (native, chunked)                          | 1             | 1 Deepgram call per 120 s chunk, 30 s overlap | $0.015                           | $0.086                      | $0.34 for a 60 min take, ×2 on Groq failover, ×1.3 with dictionary | 30% to 170%          |
| Transcribe (browser, direct body)                     | 1             | 1                                             | $0.013                           | n/a (4 MB cap, about 8 min) | $0.035                                                             | 26%                  |
| Poster re-transcription of the export                 | 1             | 1 (Deepgram by URL)                           | $0.013                           | $0.065                      | $0.26                                                              | 26% to 130%          |
| 1-Click Edit cleanup (gemini-3.1-pro)                 | 1             | 1, up to 3 on transient failure               | $0.06 (4k in, 4.4k out measured) | $0.09                       | $0.30 (3 attempts, 16k output tokens)                              | 120% to 180%         |
| Overlay placement                                     | 1             | 1 mini pass                                   | $0.008                           | $0.010                      | $0.02                                                              | 16%                  |
| Audio coaching                                        | 3             | Deepgram + 1 mini pass                        | $0.019                           | $0.03                       | $0.04                                                              | 13%                  |
| Video coaching (Google direct)                        | 5             | Files upload + 1 Gemini pass                  | $0.025                           | $0.094                      | $0.25 for a 250 MB clip                                            | 10% to 38%           |
| Full coaching                                         | 8             | above + Deepgram                              | $0.037                           | $0.16                       | $0.30                                                              | 9% to 40%            |
| Training feedback (welcome grant)                     | 3             | Deepgram + 2 mini passes                      | $0.022 (2 min rep)               | n/a                         | $0.06                                                              | 15%                  |
| Idea                                                  | 2             | router + 1 mini pass                          | $0.009                           |                             | $0.015                                                             | 9%                   |
| Script                                                | 3             | router + 1 mini pass                          | $0.007                           |                             | $0.01                                                              | 5%                   |
| Hooks                                                 | 1             | router + 1 mini pass                          | $0.006                           |                             | $0.01                                                              | 12%                  |
| Brain chat (Chirpy)                                   | 1             | router + 1 mini pass, 12 turns of history     | $0.009                           |                             | $0.02                                                              | 18% to 40%           |
| Brain spin, capture, ingest, brainstorm, publish copy | 1 each        | router + 1 mini pass                          | $0.002 to $0.009                 |                             | $0.02                                                              | 4% to 18%            |
| Idea expansion (gpt-5.4)                              | 2             | router + 1 pass, up to 40k chars              | $0.035                           |                             | $0.07                                                              | 35% to 70%           |
| AI thumbnail (Google direct, 2K)                      | 2             | 1 image call                                  | $0.103                           |                             | $0.11                                                              | 103%                 |
| Reference analysis, YouTube                           | 2             | 0 paid calls (page scrape)                    | $0.00                            |                             |                                                                    | 0%                   |
| Reference analysis, Instagram or TikTok               | 2             | Apify + Deepgram                              | $0.025                           |                             | $0.05                                                              | 25%                  |
| Reference analysis, web page                          | 2             | Jina + 1 gpt-5.4 pass on 50k chars            | $0.045                           |                             | $0.06                                                              | 45%                  |
| Creator feed, YouTube                                 | 4             | 0 paid calls (Data API on the user's token)   | $0.00                            |                             |                                                                    | 0%                   |
| Creator feed, Instagram or TikTok                     | 4             | 1 Apify run, 24 items                         | $0.12                            |                             | unbounded (no timeout or byte cap)                                 | 60%                  |

The cleanup line is the surprise. At list, gemini-3.1-pro's 4,400 output
tokens per call (mostly reasoning) make 1-Click Edit the most expensive text
action in the app and a loss at one credit on every plan, and it is also the
least discounted model on the account (11% off list in the 2026-09-03 runs).
The eval in `one-click-benchmark-review.md` Part 2 measured gemini-3.7-flash
with a keep only contract at $0.008 list per 14 minute take, 20 seconds, and a
higher score than the production model. That is the planned replacement.

Free actions that still cost us something: Instagram import streams up to 250 MB
through a function and stores the master in R2; publishing spools up to 4 GB to
a temp file; every native tab switch is a server rendered page load; the
signed out native app polls Clerk every two seconds.

## 4. Monthly cost per creator at list

Three usage shapes, each on the actions above. Storage is the incremental R2
cost for what that creator adds per month.

|                                          | Light: 4 posts, 3 min takes | Regular: 12 posts, 5 min takes    | Heavy: 30 posts, 15 min takes      |
| ---------------------------------------- | --------------------------- | --------------------------------- | ---------------------------------- |
| Posts (transcribe + cleanup + Poster)    | $0.35                       | $1.37                             | $7.23                              |
| Coaching                                 | none                        | 6 audio, $0.17                    | 10 video, $0.94                    |
| Publish copy and thumbnails              | 4 captions, $0.04           | 12 captions + 4 thumbnails, $0.52 | 30 captions + 15 thumbnails, $1.82 |
| Ideas, hooks, expansion                  | $0.04                       | $0.28                             | $0.60                              |
| Brain chat                               | none                        | 20 turns, $0.18                   | 60 turns, $0.54                    |
| Inspiration (creator feeds + references) | none                        | 2 + 6, $0.39                      | 4 + 15, $0.86                      |
| AI and provider COGS                     | $0.43                       | $2.91                             | $11.99                             |
| Credits consumed under today's ladder    | 24                          | 150                               | 382                                |
| New video stored per month               | 0.6 GB                      | 3 GB                              | 22 GB                              |

Gross margin per plan, after Stripe fees, after R2 for a full allowance, before
the fixed floor:

| Plan (monthly equivalent revenue) | Light | Regular | Heavy |
| --------------------------------- | ----- | ------- | ----- |
| Weekly ($34.62)                   | 92%   | 83%     | 55%   |
| Monthly ($24.99)                  | 93%   | 82%     | 43%   |
| Yearly ($16.67)                   | 92%   | 77%     | 15%   |

The heavy creator on the yearly plan is the problem case. They use 382 credits
a month against a 500 credit allotment, so they never buy a pack, and their
long takes, cleanup passes and thumbnails eat most of the revenue. Under the
duration based schedule in §7 that creator consumes about 560 credits a month,
crosses the allotment, and either buys packs or slows down. Either outcome
restores margin.

At a plausible mix of 60% light, 30% regular and 10% heavy, blended COGS on the
monthly plan is about $2.30 per subscriber at list, about 9% of revenue, and
roughly $0.60 at today's Surplus settlement. The business is healthy on
average. The fixes are about removing the tails.

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
model §7 recommends for the actions where our cost is per minute.

## 6. Status of the two Google direct features

Video and full coaching (`/api/feedback`) have no caller anywhere in the web
app or the native app. The route exists, is rate limited and priced, and
nothing reaches it; the only place its path appears outside the route is the
auth matcher in `src/proxy.ts`. It is not working for users today because no
user can invoke it. Vercel runtime logs could not be read to confirm traffic
(the token used for this review lacks log permission), but with no caller the
answer does not depend on logs. Until a coaching surface ships, the video
coaching lines in §3 and §7 are forward planning.

The AI thumbnail is live. Poster's cover step already lets the creator scrub
the finished video and capture the exact frame (`cover-canvas.tsx`, step 1),
then sends that frame, an optional reference image and a prompt to
gemini-3.1-flash-image on Google direct at 2K. It renders a full new image
every time, which is why it costs 10 cents.

Decision 2026-09-03 on the thumbnail: keep the frame pick as the base, then
apply changes in one of two ways and price each on its own cost.

| Path                                  | What it does                                                                                                                        | List cost                                            | Proposed credits |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------- |
| Layout edit (Remotion or Hyperframes) | Deterministic overlays on the chosen frame: title text, brand colours, logo, arrows, crop, colour grade. No model call              | Compute only, well under a cent                      | 0 or 1           |
| AI edit via Surplus image model       | Frame plus instruction to an image model on Surplus (venice-nano-banana-2 or nano-banana-pro) for changes a layout engine cannot do | $0.05 to $0.13 list (settled $0.006 to $0.013 today) | 3                |
| Full 2K regeneration on Google direct | Today's behaviour, kept as an explicit "HD regenerate" option                                                                       | $0.101                                               | 4                |

The layout path should be the default because most thumbnails are the
creator's face plus three words, and that needs no model at all.

## 7. Recommended credit schedule

Principle: at list prices a credit should cost us at most about 1.25 cents on
average, so the cheapest plan (yearly, 3.3 cents per credit) still clears 60%
on every action. Text actions stay at one credit because they cost a fraction
of that.

| Action                                        | Today   | Proposed                                                                 | Notes                                                                                                                |
| --------------------------------------------- | ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Transcribe                                    | 1       | 1 per started 5 minutes                                                  | 3 min = 1, 15 min = 3, 60 min = 12. The server already knows chunk durations. Show the price before the call.        |
| 1-Click Edit cleanup                          | 1       | 1 per started 5 minutes, on gemini-3.7-flash with the keep only contract | Measured $0.008 list per 14 minute take (benchmark review Part 2). The current model loses money at any flat credit. |
| Poster transcription                          | 1       | 0                                                                        | Reuse the editor transcript and cut list. Charge the transcribe schedule only when no transcript exists.             |
| Audio coaching                                | 3       | 3 up to 5 minutes, then 1 per extra 5                                    |                                                                                                                      |
| Video coaching                                | 5       | 5 up to 3 minutes, then 2 per extra 3                                    | Not reachable today (§6). Send `mediaResolution: low` and 1 fps when it ships.                                       |
| Full coaching                                 | 8       | 8 up to 3 minutes, then 3 per extra 3                                    | Same.                                                                                                                |
| Training feedback                             | 3       | 3                                                                        | Keep equal to the welcome grant.                                                                                     |
| Idea, script, hooks                           | 2, 3, 1 | 2, 2, 1                                                                  | Optional. Script costs no more than idea.                                                                            |
| Brain chat, spin, capture, brainstorm, ingest | 1 each  | 1 each                                                                   | Trim chat history to 8 turns of 2,000 chars.                                                                         |
| Idea expansion                                | 2       | 2 on gpt-5.4-mini, or 4 on gpt-5.4                                       | At list the large model is 35% to 70% of revenue.                                                                    |
| Publish copy                                  | 1       | 1                                                                        |                                                                                                                      |
| AI thumbnail                                  | 2       | 0 or 1 layout edit, 3 Surplus image edit, 4 HD regenerate                | See §6.                                                                                                              |
| Reference analysis                            | 2       | 1 for YouTube, 2 for Instagram, TikTok and web pages                     | Web page summaries move to the mini model.                                                                           |
| Creator feed                                  | 4       | 2 for YouTube, 6 for Instagram and TikTok                                | YouTube is free through the Data API.                                                                                |

Under this schedule the heavy creator from §4 spends about 560 credits a month
and costs about $6.90 at list (the overlap fix, Poster reuse, a cheaper cleanup
model and layout thumbnails remove most of the waste). On the monthly plan that
creator buys a pack or slows down, and margin lands above 65% either way. The
regular creator spends about 155 credits and costs about $1.60. The light
creator is unchanged.

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
This also removes the double grant in §9 item 5.

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

## 9. Problems found in the current implementation

1. Transcription is priced per call, billed per minute. The native app splits
   a take into 120 second chunks with 30 second overlaps, so Deepgram hears
   about 1.33 times the real audio, and a 60 minute take fans out 40 parallel
   calls for one credit. `AIEditService.swift` lines 176 to 178,
   `src/app/api/transcribe/route.ts` lines 224 to 233.
2. Poster transcribes the finished export again even though the editor already
   holds the words and the cut list. `PosterHandoffService.swift` line 91.
3. The 2K thumbnail on Google direct costs more than the two credits it sells
   for on every plan.
4. Cleanup on gemini-3.1-pro averages 4,400 output tokens, allows 16,000 and
   three attempts, and sends no reasoning budget. At list that is 6 cents a
   call for a one credit action. `src/app/api/clean-transcript/route.ts`
   line 41.
5. Checkout grants the full plan allotment when a trial starts, and the
   `invoice.paid` handler grants again on `subscription_cycle`. The trial to
   paid transition is a new billing period, so the first paid month very likely
   grants twice. Verify in Stripe test mode. `src/app/api/stripe/webhook/route.ts`
   lines 72 to 85 and 133 to 152.
6. A yearly trialist receives 6,000 credits on day one. The only brake is the
   400 actions per day umbrella limit.
7. Credits accumulate forever, with no distinction between plan credits and
   purchased credits.
8. The 1,000 credit pack ($0.049 per credit) undercuts the monthly plan ($0.050)
   and the packs never expire.
9. The generate routes charge after delivery and return the result free if the
   deduction fails for any reason other than insufficient balance.
   `src/app/api/generate/idea/route.ts` lines 93 to 95 and the same pattern in
   script and hooks.
10. The paywall gate returns true whenever Stripe is not configured, so losing
    the Stripe env vars in production silently makes every AI action credit only.
    `src/lib/billing/gate.ts` line 14.
11. Nothing records token usage or provider cost, and the Surplus key is shared
    with another product, so spend cannot be attributed.
12. `/api/feedback` (video and full coaching) has no caller (§6).
13. Smaller items: the capture and brainstorm route docstrings say "no credits"
    but both reserve one; the pricing cards still list speaking exam features
    and describe the allotment as "AI feedbacks" using the training feedback
    price; production Vercel carries both the old STARTER/PRO/PLUS Stripe price
    variables and the new CREATOR/CREDITS ones, so the old ones can be removed;
    Apify calls have no timeout or byte bound; the upload-url route consumes the
    transcribe rate limit bucket once per chunk, so a 15 minute take burns 10 of
    12 tokens before the transcription itself.

## 10. Engineering changes, in order of dollar impact at list

1. Reuse the editor transcript in Poster instead of re-transcribing the export.
2. Send the native take to Deepgram as one file by URL, or cut the chunk
   overlap from 30 seconds to 5. Either removes the 33% overspend.
3. Duration based credit pricing for transcribe, cleanup and coaching, with a
   preflight response that tells the client the price before it uploads.
4. Cleanup: keep only contract, gemini-3.7-flash, 8,000 token cap, three
   attempts on empty answers (benchmark review Part 2, "Recommended production
   change"). Validate on five more real takes with `scripts/clean-eval/` first.
5. Thumbnail: layout edit path as default, Surplus image model for AI edits,
   Google direct 2K as the paid HD option (§6).
6. Trial grant cap, yearly monthly drip, and a test that the trial to paid
   transition grants exactly once.
7. Separate Surplus keys per product; put Yapper's own key in Vercel.
8. Two credit buckets with rollover cap and pack expiry rules.
9. Move the generate and feedback routes onto the reserve then refund helper so
   every paid action shares one billing protocol and nothing ships free on a
   database error.
10. Fail closed on the paywall in production when Stripe is unconfigured.
11. Fix the pricing card copy, the two docstrings, the stale env vars, the
    upload-url rate bucket, and add a timeout and byte cap to Apify calls.

## 11. Measurement

Two sources, both cheap to add.

First, read the `usage` object from every provider response and write a
`provider_usage` row per call:

| Column                                                               | Purpose                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `usage_id`                                                           | Joins to the credit ledger row that paid for it                                            |
| `action`, `route`                                                    | Which paid action and endpoint                                                             |
| `provider`, `model`, `request_id`                                    | As sent; Surplus returns `x-request-id`, which is the key for settlement                   |
| `input_tokens`, `output_tokens`, `reasoning_tokens`, `cached_tokens` | From `usage` or `usageMetadata`                                                            |
| `media_seconds`                                                      | Audio or video seconds billed (Deepgram `metadata.duration`, chunk durations, clip length) |
| `list_cost_usd`                                                      | Computed at write time from a rates table. This is the pricing basis figure                |
| `latency_ms`, `attempt`, `finish_reason`, `ok`                       | Retries and failures cost money too                                                        |

Second, port the speaking coach's `surplusCostSettlement.ts`: a timer reads
`GET /v1/buyer/me`, which returns the last 20 settled requests with
`buyer_cost_usdc` and `direct_cost_usdc`, and writes one `surplus_cost_settled`
event per request id. Joining on `request_id` gives settled cost per action,
which is the margin buffer figure. With a Yapper only key, the account totals
in that response become Yapper's totals.

## 12. Assumptions and open questions

Token counts for actions without measured data are estimated at four
characters per token from the prompt caps and typical transcript sizes. Apify
per run cost is taken from the code's own $0.12 per creator estimate and public
per result prices. The `gemini-flash-latest` alias is assumed to resolve to the
3.8 Flash generation. Persona mixes are guesses until the ledger says otherwise.

Open decisions: whether the yearly commitment bonus is worth the complexity;
whether to keep the weekly plan at 25 GB given lapsed weekly users leave that
much behind; whether Chirpy on non editor tabs should cost a credit at all;
when a coaching surface ships so the video coaching route has a caller.

## 13. Sources

Surplus figures: `GET https://api.surplusintelligence.ai/v1/models` and
`GET /v1/buyer/me` with the production key, 2026-09-03; PostHog project
"Default project" (Celpip Speaking), event `surplus_cost_settled`, last 60 days.

Provider prices checked 2026-09-02 and 2026-09-03:
[Deepgram pricing](https://deepgram.com/pricing),
[Groq pricing](https://www.eesel.ai/blog/groq-pricing),
[Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing),
[Gemini video tokens](https://ai.google.dev/gemini-api/docs/video-understanding),
[OpenAI pricing](https://developers.openai.com/api/docs/pricing),
[Surplus Intelligence](https://www.surplusintelligence.ai/),
[Apify Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper),
[Vercel Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing),
[Neon pricing](https://vela.run/articles/neon-serverless-postgres-pricing-2026/),
[Clerk pricing](https://clerk.com/articles/clerk-pricing-explained),
[Stripe fees](https://checkoutpage.com/blog/stripe-processing-fees).

Competitors: [Captions](https://cutsnap.ai/blog/captions-ai-pricing-2026),
[Descript](https://sonix.ai/resources/descript-pricing/),
[Opus Clip](https://www.eesel.ai/blog/opusclip-pricing),
[Submagic](https://cutsnap.ai/blog/submagic-pricing-2026),
[Riverside](https://comparedge.com/tools/riverside/pricing),
[CapCut](https://socialrails.com/blog/capcut-pricing-guide).
