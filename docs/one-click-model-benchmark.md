_Yapper / Internal Engineering Report_

# One-Click Retake Cleaner: Trusted-Provider Benchmark

_Authoritative rerun after Surplus routing was restricted to trusted providers_

**Date:** September 3, 2026
**Scope:** Eight Surplus-hosted models; trusted providers only
**Reference:** Current manually verified one-click edit
**Status:** Benchmark complete; production model unchanged
**Review:** See `one-click-benchmark-review.md` (2026-09-03). Costs below are catalog prices; settled Surplus charges for these runs were 84% to 99% lower.

> **RECOMMENDATION: Canary Gemini 3.7 Flash. Under trusted-provider routing it completed in 19.2 seconds for $0.01290, produced a valid edit, and preserved the reported sentence and detailed metrics take. Do not switch production until an end-to-end canary is manually reviewed.**

## Executive findings

- Only Gemini 3.7 Flash and GPT-5.5 produced valid edits under trusted-provider routing.
- Gemini 3.7 Flash was the only candidate combining sub-30-second latency, low cost, and valid output.
- GPT-5.4 Mini was fastest, but its response contradicted itself and was correctly rejected by Yapper's safety validator.
- Both DeepSeek variants, both GLM variants, and Kimi K3 consumed the entire output allowance as reasoning and returned no usable answer.
- GPT-5.5 was usable but took 89.1 seconds and cost more than twenty-one times as much as Gemini Flash.

## Benchmark results

| Model                  | Time   | Cost     | Result   | Primary issue                          |
| ---------------------- | ------ | -------- | -------- | -------------------------------------- |
| GPT-5.4 Mini           | 4.5s   | $0.00798 | Rejected | Contradictory and out-of-bounds ranges |
| DeepSeek V4 Flash 0731 | 97.9s  | $0.00339 | Rejected | 16,000 reasoning tokens; no answer     |
| DeepSeek V4 Flash      | 98.1s  | $0.00353 | Rejected | 16,001 reasoning tokens; no answer     |
| GLM 5.3                | 167.1s | $0.08214 | Rejected | 16,000 reasoning tokens; no answer     |
| GLM 5.3 Flash          | 285.0s | $0.00463 | Rejected | 16,000 reasoning tokens; no answer     |
| Kimi K3                | 237.3s | $0.26296 | Rejected | 16,000 reasoning tokens; no answer     |
| GPT-5.5                | 89.1s  | $0.28167 | Valid    | Slower, costly; small omissions        |
| Gemini 3.7 Flash       | 19.2s  | $0.01290 | Valid    | Best speed/reliability balance         |

Cost method: returned prompt/completion token usage × the model's current Surplus /models token prices. Total measured spend for this trusted-provider rerun: approximately $0.6592, including rejected outputs.

## Methodology and interpretation

Every model received the same numbered 1,399-word transcript, the same retake-block system prompt, temperature 0, and a 16,000-token completion allowance. Calls ran through the same Surplus chat-completions endpoint after account routing was changed to trusted providers only. Duration is end-to-end request wall time.

### Effect of trusted-provider routing

| Model            | Previous          | Trusted           | Cost change  | Outcome change             |
| ---------------- | ----------------- | ----------------- | ------------ | -------------------------- |
| Gemini 3.7 Flash | 24.1s / $0.03944  | 19.2s / $0.01290  | −67%         | Valid → valid; better take |
| GPT-5.5          | 45.3s / $0.13706  | 89.1s / $0.28167  | +105%        | Valid → valid              |
| GLM 5.3          | 161.3s / $0.07488 | 167.1s / $0.08214 | +10%         | Valid → rejected           |
| Kimi K3          | 300s / unknown    | 237.3s / $0.26296 | Now measured | Timeout → rejected         |

A result is valid only when its delete ranges are parseable, in bounds, non-overlapping, do not contradict any keep range, and remain under Yapper's maximum deletion threshold. Invalid output is not partially applied; the application fails closed.

> **IMPORTANT CAVEAT: Word-level differences are measured against the current manually verified edit. Alternative source takes can be semantically equivalent, so difference counts are signals for review—not automatic proof that every differing word is wrong.**

## Model-by-model findings

### GPT-5.4 Mini REJECTED

- Fastest response at 4.5 seconds, but no final edit was produced.
- Returned overlapping keep and drop instructions—including ranges that it simultaneously marked for preservation and deletion.
- It also returned an out-of-bounds range ending at word 1,399 when the final valid index was 1,398.
- Would require enforced structured output plus a repair/retry contract before consideration.

### DeepSeek V4 Flash 0731 REJECTED

- Ran for 97.9 seconds and consumed all 16,000 completion tokens as reasoning.
- Finished because of the token limit and returned no user-visible JSON; therefore no final transcript exists.

### DeepSeek V4 Flash REJECTED

- Ran for 98.1 seconds and consumed 16,001 reported reasoning tokens.
- Finished because of the token limit and returned no user-visible JSON; therefore no final transcript exists.

### GLM 5.3 REJECTED

- Regressed from a valid response in the earlier unrestricted run to no usable output under trusted-provider routing.
- Consumed all 16,000 completion tokens as reasoning and ended with finish_reason=length after 167.1 seconds.
- No final transcript exists for this run; measured cost was $0.08214.

### GLM 5.3 Flash REJECTED

- Consumed all 16,000 completion tokens as reasoning and returned no visible answer.
- At 285.0 seconds, it nearly exhausted the application's five-minute request window.

### Kimi K3 REJECTED

- Returned before the five-minute ceiling, but consumed all 16,000 tokens as reasoning and produced no visible answer.
- The failed request still cost $0.26296, making it the second-most expensive model tested.

### GPT-5.5 VALID WITH ERRORS

- Kept the correct detailed metrics take and the complete reported motivation sentence.
- Removed the connector 'but' after the surgery sentence and shortened 'the work really compounds in that sense' to 'the work really compounds.'
- Trusted routing increased latency to 89.1 seconds and cost to $0.28167—more than twenty-one times Gemini Flash.

### Gemini 3.7 Flash BEST CANDIDATE

- Completed in 19.2 seconds for $0.01290 and returned a valid 396-word edit.
- Preserved the correct detailed metrics take and exactly the complete reported motivation sentence.
- Its primary clear omission was the connector 'but' after the surgery sentence; other differences were largely equivalent source takes.
- Best current speed/reliability tradeoff, subject to a manually reviewed production canary.

## Decision and next steps

- Configure Gemini 3.7 Flash only in a canary environment first.
- Add timing telemetry around the Surplus request, including model, attempt count, provider latency, finish reason, token usage, and validator outcome.
- Tighten the prompt to preserve semantic qualifiers, grammatical connectors, and complete sentence lead-ins.
- Manually review the entire canary output—not only the originally reported passage—before promoting the model to production.

## Appendix A — Complete valid model outputs

The text below is the exact retained transcript produced by each structurally valid model. Capitalization and punctuation reflect source transcription because the cleaner may delete words but cannot rewrite them.

### GPT-5.5

Duration 89.1s • Estimated cost $0.28167 • Final words 395

We're back with another update on my app. I've been traveling for surgery, so I haven't been super active the past two weeks, even so the numbers moved up quite a bit since the last update. Last update, we were at 324 users and 17 successful payments. Now we're at 553 sign ups and 28 successful payments. And we've gone to $560 in gross revenue with still $0 spent for marketing. we currently have eight active subscriptions, and three people chose the monthly plan, Which is great to see because it means people see this more than just a last minute exam cram. We're also consistently around 100 people visiting the site per day. And in the past month, six purchases came in direct, five came from AI assistants, and one came from Bing. Direct just means the analytics didn't receive a referrer, so I can't prove where they came from. But we just wrapped up the thirty day organic posting challenge that I've set for myself. and social media plus word-of-mouth is the most obvious explanation I have for these direct clicks. And through that posting challenge we also built a library of creatives that we can reuse for paid ads, as well as social proof when we reach out to teachers. Those videos keep getting found and the work starts to stack. But honestly the best thing had nothing to do with these dashboards. Someone recommended the app in a CELPIP group chat in Facebook without me asking. and a couple people emailed back saying they passed the exam and the platform helped their practice. and that is worth more than any revenue. because at the end of the day, you're playing a small part in someone becoming a Canadian resident and changing their life, that's very fulfilling and the main motivation for me to keep building this into a bigger thing. So before paid ads, I want to test out Reddit and Facebook groups properly. I might hire a person to do so. Because with ads, when you stop paying, you stop getting customers. But Reddit visibility, consistent SEO work, or one of these videos Can keep bringing people in months later. the work really compounds. So When I'm back on my feet, that's the job. keep building the organic base, and keep the product good enough that people spread the word.

### Gemini 3.7 Flash

Duration 19.2s • Estimated cost $0.01290 • Final words 396

We're back with another update on my app. I've been traveling for surgery, so I haven't been super active the past two weeks, even so the numbers moved up quite a bit since the last update. we were at 324 users and 17 successful payments. Now we're at 553 sign ups and 28 successful payments. And we've gone to $560 in gross revenue with still $0 spent for marketing. we currently have eight active subscriptions, and three people chose the monthly plan, Which is great to see because it means people see this more than just a last minute exam cram. We're also consistently around 100 people visiting the site per day. And in the past month, six purchases came in direct, five came from AI assistants, and one came from Bing. Direct just means the analytics didn't receive a referrer, so I can't prove where they came from. But we just wrapped up the thirty day organic posting challenge that I've set for myself. and social media plus word-of-mouth is the most obvious explanation I have for these direct clicks, And through that posting challenge we also built a library of creatives that we can reuse for paid ads, as well as social proof when we reach out to teachers. Those videos keep getting found and the work starts to stack. But honestly the best thing had nothing to do with these dashboards. Someone recommended the app in a CELPIP group chat in Facebook without me asking. and a couple people emailed back saying they passed the exam and the platform helped their practice. and that is worth more than any revenue. because at the end of the day, you're playing a small part in someone becoming a Canadian resident and changing their life, that's very fulfilling and the main motivation for me to keep building this into a bigger thing. So before paid ads, I want to test out Reddit and Facebook groups properly. I might hire a person to do so. Because with ads, when you stop paying, you stop getting customers. but Reddit visibility, consistent SEO work, or one of these videos can keep bringing people in months later. the work really compounds in that sense. So When I'm back on my feet, that's the job. keep building the organic base, and keep the product good enough that people spread the word.

## Appendix B — Invalid-output record

| Model                  | Final output        | Failure                                                                           |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------- |
| GPT-5.4 Mini           | No final transcript | Response contained overlapping and out-of-bounds ranges; application rejected it. |
| DeepSeek V4 Flash 0731 | No final transcript | finish_reason=length; 16,000 reasoning tokens; empty visible answer.              |
| DeepSeek V4 Flash      | No final transcript | finish_reason=length; 16,001 reported reasoning tokens; empty visible answer.     |
| GLM 5.3                | No final transcript | finish_reason=length; 16,000 reasoning tokens; empty visible answer.              |
| GLM 5.3 Flash          | No final transcript | finish_reason=length after 285 seconds; empty visible answer.                     |
| Kimi K3                | No final transcript | finish_reason=length; 16,000 reasoning tokens; failed request cost $0.26296.      |
