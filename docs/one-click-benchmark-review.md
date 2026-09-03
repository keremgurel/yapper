# Review of the 1-Click retake cleaner benchmark

Reviewed 2026-09-03 against `one-click-model-benchmark.md` (dated the same
day), `scripts/evaluate-clean-models.mjs`, the production route in
`src/app/api/clean-transcript/route.ts`, the prompt and validator in
`src/lib/studio/retake-clusters.ts`, the Surplus model catalog, and the
account's settled usage from `GET /v1/buyer/me`.

## What the benchmark got right

It used a real take rather than a synthetic one, held temperature at 0 and the
same 16,000 token allowance for every model, ran everything through the same
Surplus endpoint the app uses, and scored outputs with a validator close to the
production one. It correctly identified that five of eight models spent the
entire output allowance on reasoning and never answered, and it correctly
refused to promote a model without a manually reviewed canary. The list price
arithmetic is internally consistent: every cost in the table reproduces from
the reported token counts and the catalog prices.

## Where it is wrong or cannot be reproduced

### 1. The costs are catalog prices, not what we paid

The report multiplies token usage by the `/v1/models` prices. Those are the
providers' list prices; Surplus charges what the market clears at. The settled
rows for these exact runs (2026-09-02, 22:01 to 23:16 UTC) are still in
`GET /v1/buyer/me`:

| Model                  | Report cost per run | Settled per run | Discount |
| ---------------------- | ------------------- | --------------- | -------- |
| GPT-5.4 Mini           | $0.00798            | $0.00006        | 99%      |
| DeepSeek V4 Flash      | $0.00353            | $0.00015        | 96%      |
| DeepSeek V4 Flash 0731 | $0.00339            | $0.00019        | 94%      |
| GLM 5.3 Flash          | $0.00463            | $0.00062        | 84%      |
| GLM 5.3                | $0.08214            | $0.00116        | 99%      |
| Gemini 3.7 Flash       | $0.01290            | $0.00065        | 98%      |
| GPT-5.5                | $0.28167            | $0.00260        | 98%      |
| Kimi K3                | $0.26296            | $0.02390        | 88%      |

Total settled spend for all twenty rows was about $0.064, not the $0.66 the
report gives. Two conclusions change. GPT-5.5 cost four times Gemini 3.7 Flash,
not twenty-one times, and every valid candidate costs under a third of a cent.
Cost should not be a factor in choosing the cleanup model. Latency and validity
are the whole decision.

The account-wide discount is not uniform, so this is not a constant you can
apply. Lifetime, gpt-5.4-mini settled 78% below list and gemini-3.1-pro 64%
below; in the last 60 days both were above 97%. Any future benchmark should
read settled cost from `/v1/buyer/me` by request id, not compute it.

### 2. The fixture in the repo is not the fixture in the report

The report says every model received a 1,399 word transcript, and the GPT-5.4
Mini failure it describes (a range ending at word 1,399 when the last valid
index was 1,398) confirms that count. The committed script refuses to run
unless the fixture has exactly 1,407 words, and its hand audited keep spans
are indexed against that 1,407 word take. Either the script was edited after
the run or a different fixture was used. As committed, the report cannot be
reproduced from the repository.

### 3. The benchmark prompt is not the production prompt

The script carries its own copy of the prompt. Production's
`RETAKE_BLOCK_PROMPT` has two paragraphs the script's copy lacks: the
`[pause=Ns]` marker explanation and the rule against assembling one sentence
from separate attempts across a long pause. The script also builds the
transcript as bare `index:word` tokens, while production's `numberedTranscript`
inserts pause markers wherever the gap exceeds 0.75 seconds. The models were
therefore benchmarked on an older, shorter prompt with less context than they
get in production. Results may not transfer.

### 4. The benchmark validator is looser than production

`retakeCutsFromResponse` rejects a block whose `keep` array is empty and
rejects any answer that deletes more than 85% of the words. The script's
`parse` does neither. An output the report calls valid could be refused in
production. The script should import the production validator rather than
reimplement it.

### 5. The incumbent was not measured

The production model is gemini-3.1-pro and it does not appear in the table. The
account data shows 98 lifetime requests to it averaging 4,000 input and 4,400
output tokens (most of the output is reasoning) at $0.022 settled per call,
with no latency or validity figure. The report cannot say whether Gemini 3.7
Flash is better than what ships today, only that it is better than seven
alternatives.

### 6. One run per model at temperature 0 is not a measurement

Providers are not deterministic at temperature 0. The report's own data shows
it: the same Gemini 3.7 Flash prompt produced about 8,400 output tokens in the
first run and about 1,300 in the second, which is the whole "67% cost change"
attributed to trusted provider routing. Routing did not change any price; the
model reasoned less the second time. GPT-5.5 went the other way. The script
computes precision, recall and F1 against the hand audited edit and the report
does not print them. A defensible comparison needs at least three runs per
model on at least five audited takes, reporting median F1, wrong deletions,
and p50 and p95 latency.

### 7. Five of the eight rejections are a configuration artifact

The DeepSeek, GLM and Kimi models consumed the completion allowance as
reasoning because nothing told them how much to think. Surplus advertises
`reasoning` and `reasoning_effort` as supported parameters on
deepseek-v4-flash-0731, glm-5.3, glm-5.3-flash, kimi-k3 and gemini-3.7-flash,
and `reasoning` on gpt-5.4-mini, gpt-5.4 and gemini-3.1-pro-preview. The
benchmark sent neither. With a bounded reasoning budget those models would
have answered, and DeepSeek V4 Flash settles at about two hundredths of a cent
per call. The production `gemini-3.1-pro` id lists no reasoning parameters at
all in the catalog; the `-preview` id does. Worth checking which one we
actually want. (Part 2 tested this: Surplus passes the parameters through
and those providers ignore them, so the rescue did not happen.)

### 8. Structured output is available and unused

Every candidate lists `response_format` and `structured_outputs` as supported.
Both the benchmark and production extract JSON with a regex from free text. The
GPT-5.4 Mini rejection (an out of bounds index and a keep and drop overlap) is
the kind of error a JSON schema with `minimum: 0` and `maximum: wordCount - 1`
on every index prevents at generation time, with the validator kept as the
second line of defence.

## Improving 1-Click Edit accuracy

Ordered by how much bad output each is likely to remove. The first item is the
one the debugging notes from 2026-08-18 point at: most bad cuts traced back to
the transcript, not the model.

1. Tell the model what the audio says. The native app already computes a
   loudness envelope for every take. Words whose window sits at room tone are
   invented by the transcriber, and speech with no word assigned is a dropped
   word; both create phantom retakes. Mark such words in the numbered
   transcript (for example `[silent]` before a word with no energy) or drop
   them before the call. Deepgram also returns per word confidence and the
   transcribe route discards it (`providers.ts` maps only text, start and end).
   Passing a low confidence marker gives the model the signal it needs for the
   "obvious wrong word transcription" rule in the prompt.
2. Bound reasoning explicitly. Send a reasoning budget and lower
   `max_completion_tokens` from 16,000 to about 4,000. Treat
   `finish_reason: length` on a reasoning model as a configuration bug, not a
   model failure. This alone rescues the cheapest and fastest candidates.
3. Use structured output with a per request schema. `blocks[].keep` and
   `blocks[].drop` as arrays of two integer tuples with `minimum: 0` and
   `maximum: wordCount - 1`, strict mode. Keep `retakeCutsFromResponse`.
4. Add one repair turn before failing closed. When the validator rejects an
   answer, send the specific violation back ("drop [812, 830] overlaps keep
   [820, 821]") and accept a corrected answer once. Fail closed after that.
   This turns a fast model's occasional slip into a two second fix instead of
   a lost credit.
5. Use two models and auto apply only what they agree on. At settled prices,
   running Gemini 3.7 Flash and gpt-5.4-mini in parallel costs under a cent.
   Apply the intersection of their deletions automatically and present the
   rest as suggested cuts in the editor. Wrong deletions are the expensive
   error for a creator; agreement filtering trades a few mistakes left in for
   far fewer words wrongly removed.
6. Give the model deterministic anchors. The Swift fallback already finds
   repeated n-gram clusters. Pass those spans as candidate retake regions in
   the user message so long takes do not lose the model's attention, and log
   how often the model deviates from the anchors as a drift signal.
7. Tighten the prompt on connectors and qualifiers, as the report proposes.
   Both valid outputs dropped a "but" and one shortened "in that sense". Add a
   rule that a single connector or a sentence final qualifier is never deleted
   unless it sits inside a repeated attempt.
8. Build the evaluation harness properly. Import `RETAKE_BLOCK_PROMPT`,
   `numberedTranscript` and `retakeCutsFromResponse` from `src` instead of
   copying them. Use at least five hand audited takes of varied length. Run
   each model three times. Report median F1, wrong deletions weighted three
   times mistakes left, p50 and p95 latency, and settled cost read from
   `/v1/buyer/me` by request id. Always include the incumbent. Run it on every
   prompt change.

## Decision

Agree with a Gemini 3.7 Flash canary on latency grounds: 19 seconds against a
production model that spends 4,400 output tokens thinking is a real
improvement for the creator waiting on the edit. Do not conclude anything
about cost from the report, and do not promote until the benchmark has been
rerun with the production prompt and validator, a reasoning budget, three runs
per model, and gemini-3.1-pro in the table.

## Part 2: rerun with the improvements (2026-09-03)

The harness in `scripts/clean-eval/` implements everything above and imports
the production prompt, transcript builder and validator from `src` instead of
copying them. Fixture: the current 1,399 word take from the native app
(`scripts/clean-eval/fixtures/take-1399.json`), with the human edit taken from
the project's 35 clips. A word counts as kept when at least 35% of it sits
inside a kept clip, because the human cut lands inside the last word of a
sentence; the first version of the ground truth used word midpoints and
mislabelled 14 sentence final words, which the best model then got "wrong".
The corrected truth keeps 397 words and deletes 1,002 (72%).

180 requests across 15 models and 13 variants, 2 to 7 runs each. Settled spend
for the whole experiment: $0.50 (list about $4.80). Full table:
`scripts/clean-eval/fixtures/take-1399.results-2026-09-03.md`. Rerun with:

```
node --experimental-strip-types --no-warnings scripts/clean-eval/run.mjs \
  --fixture scripts/clean-eval/fixtures/take-1399.json \
  --models gemini-3.7-flash --variants baseline,keeponly --runs 3 --out results.jsonl
```

### Headline results

F1 is word level against the human edit. "Wrong" is words the human kept that
the model cut (the expensive error); "left" is mistakes the model did not cut.
Costs are list prices from the Surplus catalog; settled per call comes from the
account's model breakdown before and after the experiment.

| Model                                                        | Variant               | Runs | Valid            | F1 mean      | F1 min | Wrong | Left | Latency     | List per call | Settled per call |
| ------------------------------------------------------------ | --------------------- | ---- | ---------------- | ------------ | ------ | ----- | ---- | ----------- | ------------- | ---------------- |
| gemini-3.1-pro (production today)                            | baseline              | 2    | 0%               |              |        |       |      | 100 s       | $0.028        | $0.026           |
| gemini-3.1-pro                                               | all (schema + repair) | 2    | 100%             | 0.998        | 0.997  | 1     | 5    | 98 s        | $0.068        |                  |
| gemini-3.1-pro                                               | keeponly-reason       | 2    | 100%             | 0.972        | 0.967  | 27    | 29   | 55 s        | $0.024        |                  |
| gemini-3.7-flash                                             | baseline              | 2    | 100%             | 0.972        | 0.972  | 28    | 28   | 55 s        | $0.013        | $0.0004          |
| gemini-3.7-flash                                             | keeponly              | 7    | 86%              | 0.986        | 0.982  | 14    | 14   | 23 s        | $0.008        |                  |
| gemini-3.7-flash                                             | keeponly-schema       | 7    | 86%              | 0.986        | 0.973  | 14    | 14   | 29 s        | $0.008        |                  |
| gemini-3.7-flash                                             | keeponly-energy       | 2    | 100%             | 0.991        | 0.983  | 9     | 10   | 19 s        | $0.010        |                  |
| gemini-3-6-flash                                             | keeponly-schema       | 2    | 100%             | 0.982        | 0.982  | 17    | 19   | 90 s        | $0.084        |                  |
| gpt-5.5                                                      | baseline              | 2    | 100%             | 0.993        | 0.993  | 9     | 5    | 86 s        | $0.223        | $0.0056          |
| gpt-5.4                                                      | baseline              | 2    | 50%              | 0.949        | 0.949  | 28    | 72   | 9 s         | $0.026        | $0.0006          |
| gpt-5.4                                                      | keeponly              | 2    | 100%             | 0.789        | 0.774  | 41    | 323  | 10 s        | $0.021        |                  |
| claude-haiku-4.5                                             | keeponly              | 2    | 100%             | 0.869        | 0.869  | 86    | 166  | 23 s        | $0.018        | $0.0028          |
| gemini-3-5-flash-lite                                        | keeponly              | 2    | 100%             | 0.912        | 0.885  | 94    | 83   | 64 s        | $0.055        |                  |
| gemini-3.1-flash-lite                                        | keeponly              | 2    | 100%             | 0.765        | 0.765  | 24    | 366  | 5 s         | $0.003        | $0.00004         |
| gpt-5.4-mini                                                 | any                   | 8    | 0% to 100%       | 0.02 to 0.57 |        |       |      | 5 to 10 s   | $0.007        | $0.00004         |
| gpt-5.4-nano                                                 | any                   | 8    | 0% to 100%       | 0.00 to 0.15 |        |       |      | 9 to 34 s   | $0.002        | $0.00008         |
| deepseek-v4-flash, glm-5.3-flash, kimi-k2.5, claude-sonnet-5 | any                   | 34   | 0% (kimi 2 of 8) |              |        |       |      | 60 to 270 s |               |                  |

The two invalid gemini-3.7-flash runs were gateway errors (HTTP 200,
`finish_reason: "error"`, empty body, zero tokens), not model failures. The
production route already retries an empty answer three times, so in production
those become a two second delay.

### What each improvement did

The keep only contract is the change that matters. Asking for the spans that
survive instead of blocks of keep and drop removed every contradiction class
from the validator's rejections, cut Gemini 3.7 Flash's output from about 1,400
to about 320 tokens, cut its latency from 55 to 20 seconds, and raised its
worst run from 0.972 to 0.982. It made the production model valid on every run
(it was 0 for 2 under its own contract, once cut off mid JSON and once with an
overlapping drop). It also exposed the difference between a model that reasons
and one that does not: under keep only, gpt-5.4-mini and nano listed nearly the
whole transcript as kept (F1 0.02 to 0.18, zero wrong deletions, everything
left in), and gpt-5.4 fell from 0.949 to 0.789. The blocks contract was acting
as a thinking scaffold for models that do not think on their own.

The repair turn rescued the models whose mistakes are fenceposts and edge
overlaps: both gemini-3.1-pro runs and both gpt-5.4 runs under `all` came back
valid after one repair message. It never rescued gpt-5.4-mini or nano, whose
corrected answers contradicted themselves again.

The strict JSON schema did no harm on Gemini and nothing measurable for it
either; the bounds it enforces are the fencepost errors the repair turn also
catches. Anthropic models reject `response_format` through Surplus (400,
"Extra inputs are not permitted").

Audio energy markers changed nothing for Gemini 3.7 Flash (0.991 against 0.986,
inside run to run noise) and increased wrong deletions on flash-lite and Haiku.
On this take the transcript is faithful (37 words flagged quiet, 7 gaps with
unheard speech, none of them at a disputed cut), so the markers had nothing to
fix. The 2026-08-18 failure was a different transcription of the same footage.
Keep the energy measurement as a diagnostic; do not put it in the prompt until
a fixture with phantom words exists to test it against.

The repeated phrase anchors made things worse wherever they were used: `all`
scored below `baseline` for gpt-5.4 (0.949 to 0.879) and Haiku (0.869 to
0.443). Adding two thousand characters of index pairs to a prompt that already
contains the transcript dilutes attention. Drop the idea.

The connector rule produced no measurable change. GPT-5.5 still dropped two
"but"s and shortened one sentence with the rule in the prompt. The residual
errors of every strong run are those connectors and choices between
semantically equivalent takes, which the fixture cannot distinguish from real
errors.

Bounded reasoning is not available through Surplus. It passes `reasoning` and
`reasoning_effort` to DeepSeek, GLM, Kimi and Claude unchanged and they ignore
it (all of them still ran to the 8,000 token cap with no visible answer).
Google rejects `reasoning` outright with a 400 and accepts `reasoning_effort`
without reporting thinking tokens. The one model that visibly reasons through
the gateway is gpt-5.5 (4,000 to 6,000 reasoning tokens per call), and it does
so without being asked. This is also why the production model hits
`finish_reason: length` at a 16,000 token cap after writing 600 tokens: Gemini
counts hidden thinking against the cap.

### On "any model should be able to do this"

Not on this take. It deletes 72% of the words, retakes interleave across
several sentences, and the speaker restarts mid clause. Every model without
reasoning either contradicted itself (GPT mini and nano, Haiku under blocks) or
kept nearly everything (under keep only). The cheapest model that produces a
publishable edit is Gemini 3.7 Flash, and the only others in its class are
GPT-5.5 at 25 times the list price and 4 times the latency, and the current
production model at 3 times the list price and 5 times the latency once its
contract is fixed. What can be made simple is the contract and the failure
handling, so that the capable model succeeds every time instead of 50%.

### Recommended production change

1. Switch the response contract to keep only: the prompt's final paragraph
   asks for `{"keep":[[first,last],...]}`, and the reader is `cutsFromKeepOnly`
   from `scripts/clean-eval/normalize.mjs` (clamps a fencepost end, merges
   overlapping keeps, refuses an edit that keeps under 15% of the words),
   ported next to `retakeCutsFromResponse`.
2. Set `AI_CLEAN_MODEL` to `gemini-3.7-flash`, `max_completion_tokens` to
   8,000, and keep the three attempts on an empty or errored answer. Do not
   send `reasoning`; it is a 400 on Google.
3. Keep the pause markers. Do not add energy markers, anchors or the connector
   paragraph. The schema is optional and harmless on Gemini.
4. Expect about 20 seconds and $0.008 at list per 14 minute take, against about
   100 seconds and $0.03 to $0.07 today. One credit per started five minutes
   covers it comfortably at list.
5. Before promoting: export the next five real takes from the native app
   (`CurrentProject.json` after a hand edit) into `scripts/clean-eval/fixtures/`
   and run `baseline` against `keeponly` on each. One take is enough to choose
   a direction, not to declare a winner.

Two things to watch after the switch. A retake dense take produces 1,002 kept
or dropped decisions, and the two strong models disagree with the human on 10
to 30 words, almost all of them connectors or equivalent takes; the editor
should keep letting the creator undo a single cut. And Surplus's 96% discount
on Gemini 3.7 Flash is the least stable number in this document, which is why
the credit price is set at list.
