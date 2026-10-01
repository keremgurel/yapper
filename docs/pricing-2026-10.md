# Studio + Train credit pricing

Updated October 1, 2026. This is the implemented local catalog and a reviewable cost model, not a report of measured production margin. Stripe products/prices have **not** been created or changed by this work. This supersedes the public offer tables in the September pricing reports; their provider investigations remain useful evidence.

## Product model

One membership and one credit balance across Yapper Studio and Yapper Train. Choose an allowance, then monthly or yearly billing. Tools are the same across tiers; allowance and storage differ. Studio still requires a private-beta invitation. Buying a subscription must not be represented as buying an invitation.

The reference is [Higgsfield pricing](https://higgsfield.ai/pricing), inspected in the browser on October 1: allowance-led tiers, a monthly/annual switch, examples of generations per allowance, and additional credits. We reuse that structure, not its promotional unlimited-model promises or its model-specific credit conversion.

| Plan    | Monthly payment | Annual payment | Monthly equivalent on annual | Credits each month | Storage |
| ------- | --------------: | -------------: | ---------------------------: | -----------------: | ------: |
| Starter |             $19 |        $182.40 |                       $15.20 |                200 |   20 GB |
| Creator |             $29 |        $278.40 |                       $23.20 |                500 |   50 GB |
| Pro     |             $59 |        $566.40 |                       $47.20 |              1,200 |  100 GB |

All amounts are USD before taxes. Annual discount is exactly 20%. Annual credits are released monthly, not all up front. The daily anniversary job means a refill can arrive up to 24 hours after the anniversary.

Member top-ups are one-time purchases: 100 credits/$12, 300/$30, 1,000/$90. Their unit prices are higher than Creator and Pro subscription credits. The largest top-up is slightly cheaper per credit than Starter monthly, but still needs an active membership. There are no automatic overage purchases.

Unused credits remain in the existing ledger. No expiry/rollover cap is advertised or implemented. Premium actions continue to require a subscription or valid trial. Unspent credits are a future service obligation; the model assumes full redemption, not breakage.

## Published usage prices

Pricing UI and server reservations share `src/lib/billing/credit-costs.ts`; scripts/hooks/coaching retain their shared generation constants.

| Action                                                           | Credits | Boundary                                                                    |
| ---------------------------------------------------------------- | ------: | --------------------------------------------------------------------------- |
| AI idea capture/categorization                                   |       2 | One AI capture request; saving a typed note itself is free                  |
| Generate script                                                  |       3 | One generated script                                                        |
| Hook alternatives                                                |       1 | One generation request                                                      |
| Chirpy script revision                                           |       1 | One canvas ask; other Chirpy tools can invoke separately billed actions     |
| Transcription                                                    |   2/min | Ceiling of total source seconds/60; minimum one minute per submitted source |
| One-click retake cleanup                                         | 3/5 min | Transcript cleanup; transcription is additional if needed                   |
| AI thumbnail/remix                                               |      20 | One 2K image                                                                |
| Publishing titles/captions/hashtags                              |       2 | One request across selected platforms, not one charge per platform          |
| Train speaking feedback                                          |       3 | Existing bounded training-feedback pipeline                                 |
| Manual edits, recording, local export, subtitle styling, posting |       0 | Existing media/storage/platform access rules still apply                    |

Video subtitles use the transcript; they are not the same service as generated publishing captions. Regenerating an image or making another AI request incurs another charge. Transport chunks/retries within one transcription request are not independently billed. Existing clients that send multiple separate requests receive a separate quote/charge per request.

The visible example is 32 credits: capture 2 + script 3 + 1-minute transcription 2 + cleanup 3 + thumbnail 20 + one publishing-copy batch 2. This gives 6/15/37 examples from 200/500/1,200 credits, **not** those video counts plus the script/image/feedback examples. They are alternative uses of the same balance.

## Cost basis and margin model

Do not equate the retail price of a credit with the amount we can spend serving it. The cheapest new-plan credit is Pro annual: $566.40 / 14,400 = $0.03933 before fees and other costs.

Planning envelope: **$0.006 average provider cost per redeemed credit**. It is a budgeting assumption, not an enforced provider-dollar cap or a measured average. The following steady-state contribution model assumes all credits used, storage filled, payment fees of 3.6% + $0.30/charge, R2 storage $0.015/GB-month, and $1/member/month for additional variable infrastructure. Fixed overhead, acquisition, tax liability, chargebacks, failed generations, excess retry spend, and post-cancellation storage retention require separate reserves. Fees depend on the actual Stripe country, card and currency mix.

`contribution = (monthly revenue - allocated payment fees - storage - $1 variable reserve - credits × $0.006) / monthly revenue`

| Plan    | Monthly billing modeled contribution | Yearly billing modeled contribution |
| ------- | -----------------------------------: | ----------------------------------: |
| Starter |                                81.7% |                               79.8% |
| Creator |                                79.0% |                               75.8% |
| Pro     |                                79.4% |                               75.8% |

The regression test recomputes this model from the catalog; it does **not** prove production margins. At a $0.01 provider cost per credit, Pro annual falls to about 65.6%, before fixed costs and the other exclusions above. Track the actual mix, retries, and provider tokens before calling the 75% target achieved.

### Verified versus estimated costs

- Google currently lists $0.101 for a 2K Gemini 3.1 Flash Image output, plus input tokens. We budget roughly $0.12 for the thumbnail operation, hence 20 credits at the planning envelope. Previously two credits could sell for less than the image cost. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Deepgram meters decoded audio minutes. The existing repository research uses $0.0043/min batch plus $0.0013/min for keyterms. Overlap, recovery passes, and fallback can increase the bill. Two credits per source minute gives a $0.012/min planning envelope, not permission for unlimited provider retries. [Deepgram pricing](https://deepgram.com/pricing)
- Text generation and retake cleanup estimates are from `docs/unit-economics-and-pricing.md`, including the local cleanup benchmark. They are estimates tied to specific models and limits, not fresh measured cost telemetry.
- R2 lists $0.015/GB-month standard storage and usage-based operation charges. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Payment-fee assumptions use standard card processing plus Billing, not a verified merchant contract. [Stripe payments](https://stripe.com/pricing), [Stripe Billing](https://stripe.com/billing/pricing)

### Remaining economic exposure

Advanced scene planning/design/review, reference scraping, creator-feed analysis, voice-sample imports, and long-form video coaching still use their previous prices. Some were flagged as underpriced in the September report. This change fixes the requested capture/edit/thumbnail/publishing schedule, but **does not certify all Studio provider work against the $0.006 envelope**. Before activating the new paid offers, meter complete provider cost for those operations (including automatic helpers and repairs), then reprice or constrain them. Do not market unlimited AI use. Do not silently rely on temporary Surplus discounts to make an otherwise unprofitable action sustainable.

Transcription reserves based on the declared source length when available and settles against the provider's decoded duration before delivering the result. A shortfall returns 402 and refunds the initial reservation. Unknown/misreported duration still creates provider-spend exposure before settlement; the existing ingress and provider rate limits are retained, but they are request-count limits, not dollar budgets. A measured duration before provider work and a provider-dollar budget remain release work. The thumbnail price is reflected in web and Mac cover-generation labels; older distributed app versions need updating before the tariff goes live.

## Billing lifecycle and compatibility

- New trials grant 30 credits once per account. New paid allowances originate only from paid creation/renewal invoices, avoiding checkout/invoice double grants.
- Annual first installments persist their schedule in the existing credit ledger. `/api/internal/billing-allowances` releases due monthly installments with unique subscription/period/month keys. It is protected by `CRON_SECRET` and scheduled daily in `vercel.json`.
- End-of-month anniversaries clamp to the shorter month and return to the original day the following month. Missed installments catch up within the paid period. Canceled/replaced plans stop scheduled grants.
- Legacy weekly/monthly/yearly plan and old pack IDs remain resolvable for existing entitlements and outstanding webhooks. Their old grant amounts/idempotency keys stay intact; they are not sold through new checkout. This does not migrate or reprice existing Stripe subscriptions.
- New checkout validates Stripe amount, USD currency, recurring interval, and active status against the displayed offer. Mismatches fail closed. New checkout disallows promotion codes because an unmodeled discount changes the cost envelope.
- Proration invoices do not mint an additional allowance. Catalog plan migrations need a deliberate Stripe portal policy; do not offer mid-cycle allowance upgrades until the desired prorated-credit policy is defined.

## Activation configuration

Create new Stripe prices matching the exact amounts above, then configure:

- `STRIPE_PRICE_STUDIO_STARTER_MONTHLY` and `STRIPE_PRICE_STUDIO_STARTER_YEARLY`
- `STRIPE_PRICE_STUDIO_CREATOR_MONTHLY` and `STRIPE_PRICE_STUDIO_CREATOR_YEARLY`
- `STRIPE_PRICE_STUDIO_PRO_MONTHLY` and `STRIPE_PRICE_STUDIO_PRO_YEARLY`
- `STRIPE_PRICE_TOPUP_100`, `STRIPE_PRICE_TOPUP_300`, `STRIPE_PRICE_TOPUP_1000`

Keep existing `STRIPE_PRICE_CREATOR_*` and `STRIPE_PRICE_CREDITS_*` mappings for legacy event resolution. Do not reuse old price IDs under new offers. Confirm `invoice.paid` and subscription events are delivered, `CRON_SECRET` is set, and the daily refill route is deployed. No production price, subscription, database, or account was changed while implementing this local revision.
