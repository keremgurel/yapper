# Studio and Train pricing

Updated October 2, 2026. This replaces the version written earlier the same day, which sold one membership with one credit balance for both products. Studio and Train are now priced, billed and metered separately.

## What shipped (October 2)

Train shipped as described here: free practice, one free feedback session, and Train Plus for unlimited feedback with a fair-use ceiling, with its own wallet and subscription.

Studio did not change price. It is still the one Creator membership already live in `src/lib/billing/plans.ts`: $7.99 a week with 100 credits, $24.99 a month with 500, or $199.99 a year with 6,000, each with the 5 GB temporary workspace, a 7-day trial with 30 credits, and the existing credit packs. Its cost controls are described in `launch-cost-controls.md`. The membership now belongs to Studio only.

The Starter, Creator and Pro tiers in the tables below are a proposal that was not shipped. They were built on an uncommitted draft that main had already replaced, so they were left out of the merge. Read every Studio tier table, margin and Stripe variable below as proposal only.

No Stripe product, price, subscription or balance was created or changed. Margins below are modeled from list prices, not measured.

## The two offers

Studio. Prices in USD before tax.

| Plan    | Monthly | Yearly (20% off) | Per month on yearly | Credits each month | Storage |
| ------- | ------: | ---------------: | ------------------: | -----------------: | ------: |
| Starter |     $19 |          $182.40 |              $15.20 |                200 |   20 GB |
| Creator |     $29 |          $278.40 |              $23.20 |                500 |   50 GB |
| Pro     |     $59 |          $566.40 |              $47.20 |              1,200 |  100 GB |

Top-ups for Studio subscribers: 100 credits for $12, 300 for $30, 1,000 for $90. New subscribers get a 7 day trial with 30 credits, card required.

Train.

| Plan       | Monthly | Yearly (20% off) | Per month on yearly | Each month                                                                  |
| ---------- | ------: | ---------------: | ------------------: | --------------------------------------------------------------------------- |
| Free       |      $0 |                  |                     | Every exercise, prompt, timer and recording. One feedback session at signup |
| Train Plus |      $9 |           $86.40 |               $7.20 | Unlimited AI feedback, fair use                                             |

There is no card trial and no top-up. The free first session is the trial.

A feedback session is one recorded attempt that is transcribed, scored on five dimensions and coached. Train Plus is unlimited, the same model celpip-practice uses, decided on October 2. A subscriber's session costs no credits and writes no ledger entry. The plan itself is the entitlement.

Fair use: a subscriber can run 30 sessions per UTC day (`TRAIN_FAIR_USE_DAILY_SESSIONS`). The number is not shown on the pricing page, which says only that automated or abusive use may be limited. Speaking-coach uses the same ceiling; its heaviest observed user-week was 27 grades.

Without a plan, feedback is paid in Train credits at 3 per session. That covers the one free session in the welcome grant and the legacy balances described below.

An AI speaking partner is planned for later and is not part of this offer. It will need a minutes allowance, because a live voice conversation costs far more per minute than a scored recording.

The Studio tiers and prices are the ones implemented earlier today. They were checked again here against costs and kept. The Train offer is new.

## Reference: how Higgsfield prices

Read on higgsfield.ai/pricing on October 1. It shows Starter at $15 a month and Plus at $49 a month or $39 a month billed annually, with higher Ultra and Team tiers. Each plan states an allowance in generations of a named model (100 or 500 a month, or 6,000 a year on annual), a count of "unlimited" models, and a credit rate that improves with the tier ($1 buys 14 credits on Starter, 26 on Plus, 31 on Ultra, 33 on Team). There is a $3 one-time pass for 40 credits. The page says unlimited use can be slowed at busy times. It does not state rollover, expiry or refund rules.

What Yapper takes from it: lead each plan with its allowance, show a monthly and yearly switch, translate credits into a concrete example, give larger plans a better rate, and sell top-ups. What it does not take: "unlimited" anything, since every Yapper AI action has a real marginal cost, and promotional framing.

## What costs money and what does not

Free to Yapper, so free to the user: recording, the teleprompter, typed notes, manual transcript and timeline editing, silence detection, waveforms, caption styling, compositing and local export, posting, and all Train practice without feedback. These run in the browser or on the user's Mac.

Costs money each time: transcription, AI generation, image generation, reference and creator-feed scraping, and Train feedback. Storage and payment fees are the other variable costs.

## Credit costs against provider cost

Provider figures are list prices from `docs/unit-economics-and-pricing.md` sections 2 and 3 (checked September 2026). "Revenue" is what the credits are worth on the cheapest plan, Pro yearly, at $0.0393 per credit. If an action is profitable there, it is profitable on every plan.

| Action                           |                                            Credits |     Typical provider cost |     Worst case in code | Revenue at $0.0393 | Cost share, typical |
| -------------------------------- | -------------------------------------------------: | ------------------------: | ---------------------: | -----------------: | ------------------: |
| Idea capture                     |                                                  2 |                    $0.009 |                  $0.02 |             $0.079 |                 11% |
| Script                           |                                                  3 |                    $0.007 |                  $0.01 |             $0.118 |                  6% |
| Hook alternatives                |                                                  1 |                    $0.006 |                  $0.01 |             $0.039 |                 15% |
| Chirpy script revision           |                                                  1 |                    $0.006 |                 $0.015 |             $0.039 |                 15% |
| Transcription, per minute        |                                                  2 |              about $0.005 |   $0.011 with failover |             $0.079 |                  6% |
| One-click cleanup, per 5 minutes |                                                  3 |                    $0.004 | $0.03 (three attempts) |             $0.118 |                  3% |
| AI thumbnail, 2K                 |                                                 20 |                    $0.103 |                  $0.11 |             $0.787 |                 13% |
| Publishing copy                  |                                                  2 |              under $0.009 |                  $0.02 |             $0.079 |                 11% |
| Idea expansion                   |                                                  2 |                    $0.035 |                  $0.07 |             $0.079 |                 45% |
| Reference analysis               |                                                  2 |              $0 to $0.045 |                  $0.06 |             $0.079 |           up to 57% |
| Creator feed analysis            |                                                  4 | $0.12 (Instagram, TikTok) |              unbounded |             $0.157 |                 76% |
| AI overlay planning              |                                                  1 |            $0.06 to $0.12 |                  $0.29 |             $0.039 |           over 100% |
| AI overlay design, per moment    |                                                  2 |            $0.10 to $0.16 |                  $0.41 |             $0.079 |           over 100% |
| AI overlay picture               |                                                  2 |                    $0.067 |                  $0.07 |             $0.079 |                 85% |
| AI overlay revision              |                                                  2 |                     $0.08 |                  $0.30 |             $0.079 |          about 100% |
| Overlay render review            |                                                  0 |                     $0.10 |                  $0.26 |                 $0 |           unmetered |
| Train feedback session           | Unlimited on Train Plus, 3 Train credits otherwise |                    $0.022 |                  $0.06 |                n/a |           see below |

The core workflow (capture, script, transcription, cleanup, thumbnail, publishing copy) is priced safely. The overlay actions and creator-feed analysis are not: at list prices they cost more than they charge. That was true before this work and is unchanged by it. They need token logging and a reprice before Studio opens to the public. The Opus rate behind the overlay figures is an assumption, not a measured bill.

## Plan margins and sensitivity

Contribution per subscriber per month, after payment fees (3.6% plus $0.30 per charge), storage at $0.015 per GB with the quota full, and a $1 reserve for other variable infrastructure. It excludes fixed costs, acquisition, tax, chargebacks and the free actions that still cost a little.

Studio, by average provider cost per credit redeemed and by how much of the allowance is used:

| Plan            | Revenue per month | Half used, $0.006 | Half used, $0.010 | Half used, $0.015 | All used, $0.006 | All used, $0.010 | All used, $0.015 |
| --------------- | ----------------: | ----------------: | ----------------: | ----------------: | ---------------: | ---------------: | ---------------: |
| Starter monthly |            $19.00 |             84.8% |             82.7% |             80.1% |            81.7% |            77.5% |            72.2% |
| Starter yearly  |            $15.20 |             83.7% |             81.1% |             77.8% |            79.8% |            74.5% |            67.9% |
| Creator monthly |            $29.00 |             84.2% |             80.7% |             76.4% |            79.0% |            72.1% |            63.5% |
| Creator yearly  |            $23.20 |             82.3% |             78.0% |             72.6% |            75.8% |            67.2% |            56.4% |
| Pro monthly     |            $59.00 |             85.6% |             81.5% |             76.4% |            79.5% |            71.3% |            61.1% |
| Pro yearly      |            $47.20 |             83.4% |             78.3% |             72.0% |            75.8% |            65.6% |            52.9% |

$0.006 per credit is the planning figure. The core workflow example (32 credits) costs about $0.13 at list, or $0.004 per credit, so $0.006 leaves room. A subscriber who spends mostly on overlays would run well above $0.015 per credit, which is why those actions need repricing.

Studio top-ups: $0.12, $0.10 and $0.09 per credit. All three cost more per credit than Creator and Pro plan credits, so a pack never undercuts an upgrade. Contribution at $0.006 per credit is 89%, and 79% to 81% at $0.015.

Train Plus is unlimited, so margin depends on how many sessions a subscriber runs. At $0.03 a session (the planning figure; typical is $0.022, the cap in code is $0.06), with a $0.25 reserve because Train stores no video:

|             Sessions a month |   Monthly ($9.00) | Yearly ($7.20 a month) |
| ---------------------------: | ----------------: | ---------------------: |
|                           10 |             87.0% |                  88.4% |
|               30 (one a day) |             80.3% |                  80.1% |
|               60 (two a day) |             70.3% |                  67.6% |
|             150 (five a day) |             40.3% |                  30.1% |
| 900 (the ceiling, every day) | loss of about $19 |      loss of about $20 |

Break-even is about 270 sessions a month on monthly billing and 220 on yearly. A subscriber at the ceiling every day costs about three times what they pay. The ceiling bounds that loss; it does not remove it. If real usage clusters above five sessions a day, lower the ceiling or raise the price. Measure sessions per subscriber before changing either.

The free first session costs $0.02 to $0.06 per signup. It is limited to one per account by a database constraint.

A test recomputes the Studio model at $0.006 a credit and the Train model at 60 and 900 sessions from the catalog (`src/lib/billing/allowances.test.ts`). It proves the arithmetic, not production margins.

## Rules

| Question                | Studio                                                                                                                                                                                                               | Train                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Renewal                 | Monthly plans grant the allowance when each invoice is paid. Yearly plans bill once and release one month's credits on each monthly anniversary. The refill job runs daily, so a refill can land up to 24 hours late | The plan renews with the invoice. Nothing is granted, because feedback is unlimited                    |
| Rollover and expiry     | Unused credits stay in the Studio wallet. No cap, no expiry                                                                                                                                                          | Nothing to roll over. Credits from the welcome grant or a legacy balance do not expire                 |
| Spending without a plan | Not possible. Premium Studio actions need an active plan or trial. Leftover credits wait                                                                                                                             | One free session at signup, then feedback needs Train Plus                                             |
| Failed work             | Credits are reserved before provider work and refunded if it fails. Transcription settles on decoded length and refunds the difference                                                                               | A session only counts after the result is saved. A failure or a too-short recording counts for nothing |
| Cancellation            | Access runs to the end of the paid period plus a 3 day grace. Stored video is deleted 30 days after access ends                                                                                                      | Unlimited feedback runs to the end of the paid period. Saved sessions stay in the account              |
| Top-ups                 | Subscribers only. One-time, no auto-renew, no overage billing                                                                                                                                                        | None                                                                                                   |
| Trial                   | 7 days, 30 credits, once per account, card required                                                                                                                                                                  | None. One free session at signup                                                                       |
| Usable with no credits  | Recording, teleprompter, manual editing, caption styling, local export, posting                                                                                                                                      | All practice: prompts, timers, recording, exercises                                                    |

Unspent credits and sessions are a liability. The models above assume full redemption for that reason.

## How separation is implemented

| Piece          | Where                                                                                                   | What it does                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product type   | `src/lib/billing/products.ts`                                                                           | `studio` or `train`, with each product's pricing and post-checkout paths                                                                                             |
| Catalog        | `src/lib/billing/plans.ts`                                                                              | Every plan and pack has a `product`. `plansFor` and `packsFor` filter by it                                                                                          |
| Wallets        | `users.credits_balance` (Studio), `users.train_credits_balance` (Train)                                 | Two running balances. `credit_ledger.product` records which one each entry moved                                                                                     |
| Subscriptions  | `users.subscription_status`, `plan`, `current_period_end` (Studio) and the `train_` equivalents         | Two mirrors of Stripe state on one shared customer                                                                                                                   |
| Checkout       | `src/app/api/billing/checkout/route.ts`                                                                 | Reads the product from the plan or pack. "Already subscribed", trial eligibility, pack eligibility and return URLs are all judged for that product only              |
| Webhook        | `src/app/api/stripe/webhook/route.ts`                                                                   | Routes subscription state and grants by the plan's product, falling back to a product stamp set at checkout, then to Studio for subscriptions that predate the split |
| Annual refills | `src/lib/db/subscription-allowances.ts`                                                                 | Runs per product against that product's own subscription state                                                                                                       |
| Gate           | `src/lib/billing/gate.ts`                                                                               | `canUsePremium(userId, product)`                                                                                                                                     |
| Train access   | `src/lib/training-feedback/access.ts`, `src/lib/billing/train-fair-use.ts`, `src/lib/db/train-usage.ts` | A Train Plus subscriber passes until the daily ceiling, counted from completed sessions that UTC day. Anyone else needs credits for one session                      |
| Train charge   | `src/lib/db/train-wallet.ts`                                                                            | Only for accounts without a plan. Spends the Train wallet, with the one exception in the next section                                                                |
| Status API     | `/api/billing/status`                                                                                   | Top-level fields stay Studio's, so the Mac app keeps working. A `train` object is added                                                                              |

Migration `drizzle/0034_product_wallets.sql` adds four columns to `users`, one to `credit_ledger`, and a check constraint. It rewrites no row. Existing ledger rows default to Studio.

### Accounts from before the split

An account created before October 3, 2026 was sold or granted one balance for everything, and keeps it. A Train charge tries the Train wallet first and then that balance. An account created since buys Studio credits for Studio only. The rule is one pure function, `trainSharesStudioWallet`, with tests, and the date is `PRODUCT_SPLIT_AT` beside it.

New accounts get the welcome grant in the Train wallet and start with no Studio credits.

No balance is moved by the migration.

## To activate

Train Plus needs two Stripe prices: `STRIPE_PRICE_TRAIN_PLUS_MONTHLY` ($9 a month) and `STRIPE_PRICE_TRAIN_PLUS_YEARLY` ($86.40 a year). Until they exist, Train Plus checkout answers "not available for checkout yet" and free practice and the free first session work as normal.

Studio keeps its existing `STRIPE_PRICE_CREATOR_*` and `STRIPE_PRICE_CREDITS_*` variables. Nothing new is needed.

The Stripe billing portal shows both subscriptions on the one customer. Its return URL is now `/pricing`.

## Pronunciation scoring cost

Each feedback session also runs Azure Speech pronunciation assessment on up to the first 90 seconds of the recording. Azure bills this as standard speech to text, about $1 an audio hour at list price, so at most about 2.5 cents a session. A typical one-minute rep adds under 2 cents. This is on top of the transcription and coaching cost above, and is not yet measured on real usage.

## Open questions

1. Train Plus at $9 is set from cost, not from willingness to pay. Competitor prices were not verified.
2. The fair-use count reads completed sessions, so several requests sent at the same instant could pass the check together and overshoot by a few. The provider rate limits bound that. Tighten it only if abuse shows up.
3. Overlay and creator-feed actions need metering and repricing before Studio is public.
4. Plan changes in the Stripe portal do not grant a prorated allowance. Do not offer upgrades mid-cycle until that policy is decided.
5. Not tested: a real checkout, a real webhook delivery, or the migration against a copy of production.
