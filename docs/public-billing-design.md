# Public billing and cost controls

Evaluated 2026-09-12. Design proposal, not implemented pricing. Public usage is the target. Invited testers use the same product and metering, with manual grants. No prices, balances, subscriptions, or deployments were changed for this evaluation.

This supplements `unit-economics-and-pricing.md`. That report contains historical estimates and partially superseded implementation findings; it is not a current invoice. This evaluation checks the current source and selected official list prices. Production environment overrides, negotiated rates, actual Stripe prices, invoices, and user usage distributions have not been verified.

## Merge review (2026-09-20)

This remains a design proposal. Merging it does not implement credit buckets,
manual premium grants, duration-based prices, or retention policies. Core ASR
and R2 rates were rechecked against the linked official pricing pages; the
Stripe, Neon, and Vercel scenarios remain illustrative dated assumptions and
must be revalidated against the deployed accounts before changing prices.
The current transcription recovery change preserves uncertain audio but does
not implement the accounting redesign described here.

## Current behavior

| Operation                              | Current user charge                           | Evidence                                                                                               |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Record with the idea microphone        | None while recording                          | `src/lib/voice/voice-capture-controller.ts`                                                            |
| Stop and transcribe                    | 1 credit per request, independent of duration | `src/lib/voice/transcribe-capture.ts`, `src/app/api/transcribe/route.ts`, `src/lib/billing/actions.ts` |
| Save the transcribed or typed idea     | Free database write                           | `src/lib/ideas/client.ts`, `src/app/api/ideas/route.ts`                                                |
| Expand an idea with AI                 | Separate 2-credit action                      | `src/lib/billing/actions.ts`                                                                           |
| Transcription provider failure         | Attempts to refund the reserved credit        | `src/app/api/transcribe/route.ts`, `src/lib/billing/actions.ts`                                        |
| Successful transcription with no words | Can still consume the credit                  | The transcription success path does not check for an empty result                                      |

The `capture_idea` paid action is a different AI workflow; its name does not mean that saving a note in Idea Bank costs a credit. Uploading larger dictation audio does not itself deduct another credit, although the upload ticket and transcription each consume request-rate budget.

The recorder cutoff fix is not a complete public-launch solution. Recording now has no application time cutoff, but the take remains in memory, the stored upload path caps each object at 64 MiB, and provider failures do not expose a recoverable recording. The fallback currently uploads a whole file as a multipart attachment. Groq documents a 25 MB attachment limit, so large takes need a URL or bounded audio segments for fallback as well. [Groq speech documentation](https://console.groq.com/docs/speech-to-text)

## Pricing recommendation

The proposed product direction is a subscription with monthly credits, optional one-time credit packs, and adjustable credit consumption per action based on its cost to Yapper. Higgsfield documents this monthly-allowance and top-up structure. Its individual-plan rollover and pack-expiry policies are separate decisions; adopting the structure does not adopt all of its terms. [Higgsfield plans](https://higgsfield.ai/creator-hub/help-center/plans/how-do-higgsfield-plans-work), [Higgsfield credit packs](https://higgsfield.ai/creator-hub/help-center/credits/how-credit-packs-work)

Keep one customer-facing credit balance, with costs visible before paid work. Separate three concerns internally:

1. **Access:** a paid subscription, valid trial, or a manual premium grant unlocks premium features and the corresponding storage quota.
2. **Usage allowance:** plan credits, purchased credits, and promotional credits pay for individual actions. Premium access alone does not imply unlimited provider work.
3. **Provider spending:** an independent budget covers real monetary exposure, including failed calls, retries, automatic helpers, and free/promotional use.

Recording, typing, saving drafts, and local editing stay free. Paid cloud transcription should initially cost **1 credit per source minute**, prorated by the second with a 10-second minimum per submitted take. Display fractional credits. Use integer accounting units internally (60 units per credit), not floating-point balances; migrate existing amounts by multiplying by 60. A 30-second note costs 0.5 credits, a two-minute note 2, and a 15-minute note 15. Do not round or charge independently for transport segments or automatic retries. These prices are proposed, not active.

The previous report's proposed 1 credit per five minutes is too thin for the current yearly discount and leaves little room for retries. Recording duration, billed source duration, and total provider-processed duration must be separate measurements. Charge the customer once for their source; our cost ledger includes overlaps and retries.

Retain predictable fixed prices for bounded text actions only after measuring their complete execution cost. Use duration bands for long transcript cleanup and coaching, per-image prices for image generation, and per-moment prices for overlay design. Automatic routing, validation, and repair belong in the parent action's cost and attempt budget. No unmetered helper route may initiate expensive work independently.

For each action define a versioned price, input limits, permitted models, output token limits, maximum attempts, and maximum provider dollars. Set the quote from measured cost at list rates with headroom, including the fallback path. Provider discounts are additional margin. Do not make provider/model changes without rerunning the cost checks. Expensive actions with unverified cost remain unavailable for public execution until priced and bounded.

## Adjustable cost-to-credit conversion

There are two different dollar values: **revenue received per credit sold** and **the cost budget that one consumed credit supports**. A credit sold for five cents cannot support five cents of provider spending and still cover operating costs. Compute the sustainable budget using the cheapest normal credit offer, including annual discounts and promotional sale prices, assuming the entire allowance is redeemed. Gift credits have no revenue and belong in the promotional budget.

For each plan or pack:

`provider budget per credit = (revenue × (1 − target contribution margin) − payment fees − allocated non-provider variable costs) / credits supplied`

Use the lowest sustainable result across the offers as the common budget, or adjust the offer that fails. Include retained storage, compute and helper calls in the allocation without counting them twice. Fixed overhead and acquisition still need to fit within remaining contribution. The budget is a business setting, not the cash value of a customer's credits.

For a priced action:

`credits = round up to the published increment(estimated complete provider cost / provider budget per credit)`

Estimate the entire bounded customer operation: selected model, input/output allowance, duration, image resolution, helper calls and expected retry overhead. Enforce an additional maximum spend for worst-case attempts. A cheap tool call and an expensive reasoning/image operation must not share a generic one-credit price just because both invoke AI.

Illustration only, using a provisional **$0.006 provider budget per credit**:

| Estimated complete cost | Credit charge at 0.1-credit increments |
| ----------------------: | -------------------------------------: |
|                  $0.003 |                                    0.5 |
|                  $0.006 |                                      1 |
|                  $0.030 |                                      5 |
|                  $0.120 |                                     20 |

These are arithmetic examples, not measured action costs or approved tariffs. The $0.006 budget itself must pass the plan-level calculation above. The earlier one-credit-per-minute transcription example is provisional and should be calibrated by this same system, rather than becoming a permanent special-case exchange rate. Second-based transcription uses its own published accounting increment; round the complete source once, not every segment.

Implement two central, versioned tables:

- `provider_rates`: provider/model, modality, input/output/cache token rates, audio-minute and image rates, currency, source, verification date, effective date. Keep actual settlement separate from the list-price planning basis.
- `action_prices`: action, supported model/quality tier, billing unit (operation, source second, image or moment), credit rate, input limits, maximum attempts/spend, effective date, and price version. Define the whole workflow's price rather than exposing internal tool chains to the user.

An admin pricing page should show observed median/p95 costs, credits charged, implied margin by plan, and the effect of a proposed change on example workflows. You can adjust an action's credit rate without changing the subscription's monthly allowance or pack sizes. Publishing a revision affects new quotes only: active jobs retain their agreed price, and existing balances are not rewritten. Explain material increases before a customer starts paid work. Never silently float the final charge with every provider invoice or bill the customer extra for an automatic retry.

The customer sees one balance, a cost beside each action, a usage history with charges/refunds, and a Buy credits action. The internal breakdown still distinguishes subscription, purchased and gifted credits. Manual premium and credit grants use the same published action prices.

## Transcription economics

The current route defaults to Nova-3 and always includes product keyterms. For planning, use $0.0043/minute for monolingual prerecorded audio plus $0.0013/minute for keyterm prompting, totaling **$0.0056/minute**. Multilingual batch pricing is higher; verify the resolved language mode against provider usage. [Deepgram pricing](https://deepgram.com/pricing)

The current Groq backup lists $0.111/hour, or $0.00185/minute. A conservative full primary attempt plus full fallback is therefore $0.00745/minute. This is a stress scenario, not the measured failure rate. [Groq speech documentation](https://console.groq.com/docs/speech-to-text)

| Source audio | Primary estimate | Primary + fallback stress estimate | Proposed credits |
| ------------ | ---------------: | ---------------------------------: | ---------------: |
| 2 minutes    |          $0.0112 |                            $0.0149 |                2 |
| 15 minutes   |          $0.0840 |                            $0.1118 |               15 |
| 60 minutes   |          $0.3360 |                            $0.4470 |               60 |

These are single-pass dictation estimates, excluding infrastructure. Editor overlap, missing-speech recovery, and other repeated processing increase provider minutes. Under today's flat billing, an hour brings only about $0.033 of allocated credit revenue on the yearly plan, versus $0.336 primary transcription cost. Removing the timer without changing the economics does not make that sustainable.

## Plans and long-run costs

The detailed [storage public-scale review](storage-public-scale-review.md) now defines when binaries are saved, temporary-file expiry, publishing dependencies, cancellation retention, cleanup capacity, and costs at 1,000–10,000 users. Recurring storage is funded by membership; processing-credit packs do not buy indefinite additional storage.

Starting proposal: retain $24.99/month for 500 credits. Retain the $199.99 annual price only with **500 credits issued monthly** and a measured margin gate. Use the same 50 GiB storage quota for both; the current yearly 100 GiB bonus compounds the annual discount. Weekly can retain $7.99/100 credits with its own weekly issuance and 25 GiB quota. Existing customer promises need an explicit migration policy before any change.

Keep purchased credits separate and non-expiring. Cap unused plan credits at two allotments. Promotional credits have explicit expiry. Spend expiring credits first and purchased credits last. Refunds return to the original grant bucket with a documented expiry grace so a failed job does not destroy the refunded allowance. Paid packs require premium access; clearly disclose that retained credits do not extend an expired membership.

Proposed top-ups: 100/$9, 300/$24, 1,000/$69, avoiding a bulk pack that undercuts monthly membership credits. For public self-service trials, recommend 30 nonrenewing promotional credits valid for seven days, independent of billing cadence, with a $0.30 provider-spend ceiling and verified account eligibility. Validate that this covers a useful end-to-end first session; allow preview/draft capture after depletion. Manual beta grants are independent of this trial policy.

The following stress test assumes every monthly credit is consumed, storage remains full all month, and credits cost the specified amount in provider work. It is not a forecast of user behavior. Monthly revenue on annual subscriptions is allocated as price/12.

Stripe fees here are an illustrative US domestic-card scenario: 2.9% + $0.30 Payments plus 0.7% Billing. Actual merchant country, international cards, taxes, currency conversion, disputes, and contractual fees must replace this assumption before approving prices. [Stripe Payments](https://stripe.com/en-us/pricing), [Stripe Billing](https://stripe.com/en-us/billing/pricing)

R2 Standard storage is $0.015/GB-month. Source quotas are binary GiB, so 50 GiB is approximately $0.805/month and 100 GiB $1.611/month at full utilization, excluding operations. Do not subtract shared free tiers when modeling large-scale marginal cost. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

| Monthly equivalent                       | Provider $/consumed credit | Provider cost | Storage | Payment + Billing | Remaining contribution | Contribution % |
| ---------------------------------------- | -------------------------: | ------------: | ------: | ----------------: | ---------------------: | -------------: |
| Monthly, 50 GiB                          |                   $0.00560 |         $2.80 |   $0.81 |             $1.20 |                 $20.19 |          80.8% |
| Monthly, 50 GiB, fallback stress         |                   $0.00745 |         $3.73 |   $0.81 |             $1.20 |                 $19.26 |          77.1% |
| Current annual, 100 GiB                  |                   $0.00560 |         $2.80 |   $1.61 |             $0.62 |                 $11.63 |          69.8% |
| Proposed annual, 50 GiB                  |                   $0.00560 |         $2.80 |   $0.81 |             $0.62 |                 $12.44 |          74.6% |
| Proposed annual, 50 GiB, fallback stress |                   $0.00745 |         $3.73 |   $0.81 |             $0.62 |                 $11.51 |          69.1% |
| Proposed annual, expensive feature mix   |                   $0.01000 |         $5.00 |   $0.81 |             $0.62 |                 $10.24 |          61.4% |

Contribution here excludes app compute, database, authentication, observability, support, acquisition, refunds, taxes, and storage operations. It is not net profit. The proposed annual baseline has only about **$0.77/user/month** of further variable-cost room before contribution falls below 70%. Pricing all actions as though their cost is transcription cost would be a mistake.

Target at least 70% contribution after all measured variable costs for the normal mix, and at least 60% under a defined heavy-use/failure stress mix. Test 100% allowance consumption and maximum contractual rollover, not just low average usage. If annual pricing fails, raise price, reduce allowance, or remove the storage bonus; do not silently throttle customers who have paid credits.

At 1,000 fully consuming monthly subscribers in the baseline illustration: $24,990 gross subscription revenue, $2,800 provider cost, roughly $805 storage and $1,200 payment fees, leaving $20,185 before other costs. A thousand users making one one-hour transcription under today's flat charge instead causes $336 of primary ASR spend for only 1,000 credits consumed. These examples isolate unit economics; actual profitability needs the feature mix and paying/free-user ratio.

Monthly operating model: net subscription and pack revenue minus provider attempts, retained storage/operations, compute, DB, auth, payment costs, refunds and support. Allocate fixed platform bills separately. Track active users and retained bytes over time: storage is an ongoing stock, and canceled/free accounts still cost money. Publish a retention policy with notice and download access before removing cloud media. Free accounts currently have 2 GiB each; 10,000 full free accounts would represent roughly $322/month in storage alone.

## Capture and billing lifecycle

1. Start recording immediately and persist it incrementally to durable local storage. Show the known transcription rate and running estimate. Storage exhaustion must preserve completed audio and offer recovery; it must never discard the take.
2. Create independently decodable segments for upload/processing. A MediaRecorder timeslice is not necessarily an independently playable file; preserve container boundaries and test continuity. Long recordings must not require a whole-file memory allocation.
3. On Stop, retain the complete recording and verify duration server-side before paid provider work. Client-declared duration is an estimate, not billing authority. Bound metadata probing and decoding as well as uploads.
4. Issue a server-owned quote tied to source identity, duration, action, price version, expiry, and a request id. A displayed estimate can authorize processing within a visible ceiling; request confirmation only if the verified quote exceeds it.
5. Atomically reserve credits and a provider-spend budget before enqueueing cloud work. Persist the job and its idempotency key. Do not use the existing quantity helper unchanged for duration pricing: it currently caps quantity at eight.
6. Process in a bounded worker queue. Store results durably, then settle the credit reservation once. Client disconnects and repeated submit/retry calls retrieve the same job/result rather than initiating new paid work.
7. On failure, release customer credits exactly once while retaining actual provider cost. Reconcile abandoned jobs and failed refunds. No-speech results should not consume customer credits; failed/empty attempts still count against abuse and dollar budgets.
8. If balance or premium access is insufficient, keep the recording, offer top-up/access or download, and resume the same job after eligibility is restored. No mid-thought stop and no card overage without explicit opt-in.

Preflight access and an upload-byte reservation must also apply to temporary storage tickets. Delete temporary objects on all terminal paths and expire abandoned uploads automatically. Current ticket issuance authenticates and rate-limits but does not check premium or credits. Current cleanup is not guaranteed on preflight failures or process termination.

## Manual grants for invited testers

Add an admin account page with two independent operations:

- **Grant credits:** amount, optional expiry, reason, recipient and a unique grant id. Store grant actor and timestamp in the ledger; retries cannot duplicate it. This changes allowance, not membership.
- **Grant premium:** plan-equivalent capabilities/storage, start/end date, reason and optional separately stated recurring allowance. Default to no hidden unlimited allowance. Do not change Stripe subscription status or start a paid subscription. A valid manual grant OR an entitled Stripe subscription unlocks access; expiration/revocation affects only that grant.

Both may be applied together as one explicit admin action. Effective quota/access must use the same resolver everywhere, including storage. Reuse the existing admin allowlist but enforce it server-side on every mutation. Audit revocation, refund and support adjustments. Classify consumed gift credits as promotional spend with zero associated cash revenue; gifting 500 credits cannot be counted as $24.99 earned. Manual accounts retain the same concurrency and dollar controls as customers.

## Launch blockers verified in source

| Finding                                                                                               | Required change                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Flat transcription cost; no authoritative duration in the single-key path                             | Versioned duration pricing and server-verified media metadata                                                          |
| Whole-take memory buffering and no recovery after transcription failure                               | Durable recording, resumable processing, download/retry                                                                |
| Full plan grant at trial checkout, including annual 6,000                                             | Explicit trial allowance; paid monthly issuance keyed to entitlement period                                            |
| Checkout session and renewal invoice use different grant keys                                         | Test trial conversion, payment failure and webhook reordering; separate intended trial and paid grants from duplicates |
| Generate idea/script/hooks perform provider work before deduction, deliver free on deduction failures | One reserve/settle protocol with idempotency across all paid routes                                                    |
| `canUsePremium` allows access when Stripe is unconfigured                                             | Fail closed in production and validate deployment configuration                                                        |
| Refund helper calls non-idempotent grant and only logs failures                                       | Unique reservation settlement, durable refund reconciliation                                                           |
| One aggregate balance and no manual premium entitlement                                               | Grant buckets, common entitlement resolver, audited admin controls                                                     |
| No provider usage/cost table found in the inspected DB schema and billing/transcription paths         | Per-attempt usage ledger and aggregate cost reporting                                                                  |
| Rate limits count requests rather than dollars or audio seconds                                       | Atomic per-user and global spend reservations, concurrency caps and queue                                              |

Older report findings must be rechecked before acting: cleanup now defaults to `gemini-3.7-flash` with an 8,000-token cap, and transcription upload tickets already support batch signing. Do not repeat those old fixes blindly.

## Measurement and release criteria

Record each provider attempt: user, job, action, reservation, provider/model, request id, source seconds, billed seconds, input/output/cache/reasoning tokens, image count/resolution, list-rate version, estimated cost, settled cost when available, latency, retries and outcome. Failed attempts must remain in the spend ledger even when the user's credit charge is zero. Reconcile daily against provider totals with product-specific credentials or attribution. Avoid storing transcript text in billing telemetry.

Use one global daily provider-dollar budget and per-user budgets with atomic holds for in-flight work. Monitor at 50/80/100% of the configured global budget; at exhaustion, queue new cloud work with an honest status while preserving local capture. Initial amounts must be set from the actual operating budget and provider capacities, not invented from request counts. Manual promotional grants consume a separately visible marketing budget.

Before public availability, demonstrate: correct second-based charges; long and fragmented recordings; no loss when out of credits; accurate source duration despite overlap; same-job retries without double charges; crash recovery; exactly-once refund and webhook grants; monthly issuance on annual plans; bucket expiry/rollover; manual premium expiry unaffected by Stripe webhooks; simultaneous requests unable to exceed balances/spend holds; and closed access under missing production configuration.

Replay representative full workflows at least 30 times each to establish an initial observed cost distribution, then collect production percentiles continuously. Include images, overlay review/repair, cleanup, references, retries and failed attempts. This sample is an engineering starting point, not statistical proof of tail costs. Simulate 100, 1,000 and 10,000 users with free/paid/gift cohorts, full credit redemption, low trial conversion, provider-price increases and accumulating retained storage. Approve each enabled action's budget and each plan's margin before opening public access.

Implementation order: durable capture and unified job accounting; provider-cost telemetry and dollar controls; versioned action prices and credit buckets; trial/annual issuance; manual grants; then measured pricing validation and public release.
