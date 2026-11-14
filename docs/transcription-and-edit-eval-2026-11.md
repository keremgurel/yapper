# Transcription and 1-Click Edit: accuracy and cost, measured

November 13, 2026. Everything here was run that day on real takes. No production code or setting was changed.

## What was tested on

Five takes from the Mac app's project folder, each a talking-head ad recorded on the DJI with the script repeated until every line landed: 21.6 minutes of audio and about 2,200 words in total, between 2.9 and 6.4 minutes each. Each project holds the finished cut, so the clips the video shipped with are the ground truth for what to keep. Between 52% and 76% of each take was cut.

The dense 14 minute take from September (`scripts/clean-eval/fixtures/take-1399.json`) was added for the edit models, because its cut was made by hand before the current model shipped.

The five new fixtures are in `scripts/clean-eval/fixtures/2026-11-*.json`. The scripts are in `scripts/asr-eval/` and `scripts/clean-eval/run-many.mjs`. Audio was extracted with ffmpeg to mono AAC at 96 kbps.

Two limits apply to every number below. Five takes from one speaker and one microphone is a small sample. And the five finished cuts were most likely started with 1-Click Edit on the app's own transcript, so the production pipeline has a home advantage on them.

## Transcription

### Surplus has no word timings

All six speech models on Surplus accept only `json` or `text` as the response format and return the transcript and a duration. `verbose_json`, `srt` and `vtt` are refused. A cut needs a start and end for every word, so none of them can replace Deepgram on its own.

A Gemini chat model on Surplus will take audio and return words with times. On one minute of audio, gemini-3.7-flash matched 121 of 123 words, with start times a median of 160 ms away from Deepgram's and 420 ms away at the 90th percentile. That is too loose to cut on. gemini-3-5-flash-lite was 2 seconds off. The call cost $0.00006 settled and about $0.010 at list, which is more than Deepgram at list.

### How many words each transcriber drops

There is no human transcript of these takes, so ElevenLabs Scribe v2 is the reference: it returned the most words on every take. Dropped words matter most, because a dropped restart hides a retake from the edit model.

| Transcriber                                                                        | Word timings | Error against reference | Words dropped (of 2,217) |
| ---------------------------------------------------------------------------------- | ------------ | ----------------------: | -----------------------: |
| Production pipeline (Deepgram Nova-3, 120 s pieces, 30 s overlap, recovery passes) | yes          |                    7.7% |                       61 |
| Deepgram Nova-3, 15 s pieces, 2 s overlap                                          | yes          |                    8.3% |                       64 |
| xAI speech to text, through Surplus, one file                                      | no           |                    9.6% |                       70 |
| Whisper large v3, through Surplus, one file                                        | no           |                   10.6% |                       69 |
| Deepgram Nova-3, one file                                                          | yes          |                   10.6% |                      137 |
| Deepgram Nova-3, 120 s pieces, 30 s overlap, no recovery                           | yes          |                   10.9% |                      146 |
| Deepgram Nova-3, 30 s pieces, 2 s overlap                                          | yes          |                   10.3% |                      112 |
| Parakeet, through Surplus                                                          | no           |                   14.0% |                      221 |
| Groq whisper-large-v3-turbo                                                        | yes          |                   19.2% |                      324 |
| Groq whisper-large-v3                                                              | yes          |                   24.4% |                      412 |

The 30 second overlap buys nothing by itself. With the overlap and without the recovery passes, Deepgram drops as many words as it does on a single file. The production pipeline's accuracy comes from the short recovery windows.

Short pieces do the same job as recovery. Fifteen second pieces with two seconds of overlap matched the production pipeline's word count, and billed 1.15 times the audio length. Production bills at least 1.2 to 1.33 times for the overlap, plus the recovery windows.

Groq's whisper is a poor failover for this product. It drops a fifth to a quarter of the words, and the words it drops are repeated attempts. Its word times were also loose: 1.2 seconds off the cut edges at the 90th percentile, where Deepgram was within 0.3.

### What the transcript does to the cut

The production edit model was run on each transcript and scored against the finished cut.

| Transcript                                | Cut F1 | Words wrongly cut | Mistakes left in | Kept text differs from the shipped video by |
| ----------------------------------------- | -----: | ----------------: | ---------------: | ------------------------------------------: |
| ElevenLabs Scribe v2, direct, one request |  1.000 |                 0 |                0 |                                        0.0% |
| ElevenLabs Scribe v3, direct, one request |  1.000 |                 0 |                0 |                                        0.0% |
| Production pipeline                       |  0.999 |                 6 |                0 |                                        0.7% |
| Deepgram, 15 s pieces                     |  0.988 |                16 |               47 |                                        2.7% |
| Deepgram, one file                        |  0.956 |                65 |               91 |                                        3.0% |
| Groq whisper turbo                        |  0.942 |                97 |              205 |                                       12.5% |

Totals are over ten runs (five takes, twice), and fifteen for the two Scribe rows. The production row is the one with the home advantage.

### ElevenLabs Scribe, called directly

Through Surplus, Scribe returns text only. Called directly at `api.elevenlabs.io/v1/speech-to-text` with `timestamps_granularity=word`, it returns a start and end for every word. The text is the same as the Surplus route gives (0.6% apart over the five takes).

Each take went up as one request and came back in 2 to 5 seconds. The production edit model then cut all five takes exactly as the finished videos were cut, on every one of fifteen runs: no word wrongly cut and no mistake left in. That is a better score than the production pipeline gets on its own transcript, without the home advantage.

Its word times agree with Deepgram's. Word starts are a median of 40 ms apart and 120 ms at the 90th percentile. Scribe ends each word about 80 ms earlier than Deepgram does, so its words are shorter (160 ms at the median against 240). Measured against the edges of the finished cuts, Scribe's word boundaries were the closest of any transcriber: within 160 ms at the 90th percentile and never more than 188 ms away, where Deepgram's were within 290 ms and up to 458.

Scribe v2 lists at $0.0033 a minute in one request. Deepgram lists at $0.0043 a minute and production sends it at least 1.2 times the audio, so the same minute costs $0.0052 or more before keyterms. Scribe is about a third cheaper per minute of footage and needs no pieces, overlap or recovery passes. Scribe v3 scored the same; its price was not on the pricing page.

Before production moved to it, these would need checking. The takes here run to 6.4 minutes, and nothing longer was tested. The Mac app's finishing passes were tuned on Deepgram's longer word ends, and Scribe's are 80 ms shorter. A request body over 4.5 MB cannot pass through Vercel, so the audio would go by link (`source_url`), the way the Deepgram link route does today.

### Scribe through the transcribe route

`TRANSCRIPTION_PRIMARY=elevenlabs` offers a take to Scribe first and leaves Deepgram and Groq behind it. The Mac app still uploads 120 second pieces with 30 seconds of overlap, so under the flag Scribe transcribes those pieces and the route merges them. That path was run on the five takes with the route's own module and merge, eight pieces at a time: 14 pieces came back in 5 seconds with no request refused.

| Scribe through the route                        | Cut F1 over 15 runs | Words wrongly cut | Mistakes left in |
| ----------------------------------------------- | ------------------: | ----------------: | ---------------: |
| English pinned (`language_code=en`), as shipped |               1.000 |                 0 |                3 |
| Language left to detect                         |               0.988 |                80 |               80 |

Left to detect the language, Scribe judged each piece on its own and wrote the same sentence two ways, "2026" in one piece and "twenty twenty-six" in the next. The merge could not match them across the seam and interleaved both, and the edit model then preferred an earlier clean attempt over the garbled final one. Pinning English, which is also Deepgram's default, removed it.

Per minute of footage under the flag, Scribe costs $0.0033 times the 1.2 to 1.33 the overlap adds, plus a quarter for keyterms: about $0.005. Deepgram on the same pieces with keyterms is about $0.007, before its recovery passes. The rest of the saving, down to $0.0033 to $0.004, needs the app to upload a take as one file.

Poster's video masters stay on Deepgram under the flag. Scribe takes the audio in the request body here, and a master can be hundreds of megabytes.

### Scribe on a long take

The five takes were joined into one of 21.6 minutes and 2,150 words, with the five finished cuts as its ground truth. Scribe took it as one request and answered in 7.5 seconds.

| Transcript of the 21.6 minute take | Usable answers | Cut F1 | Words wrongly cut | Mistakes left in |
| ---------------------------------- | -------------: | -----: | ----------------: | ---------------: |
| Scribe v2, one request             |         6 of 6 |  0.998 |                 0 |               36 |
| Production pipeline                |         3 of 6 |  0.989 |                53 |               46 |

Six runs each, three on gemini-3.7-flash and three on gemini-3.8-flash; counts are totals over the usable answers. On the production transcript half the answers were ones the route would reject and retry.

### Long pieces instead of overlapping ones

With Scribe first, the Mac app now uploads pieces of up to ten minutes joined by five seconds, so a take of ten minutes or less is one request. The service tells the app which plan to use (`GET /api/transcribe/plan`); with Deepgram first it still answers 120 second pieces with 30 seconds of overlap, and an app that gets no answer uses those.

The pieces below were produced by the app's own PCM conversion and AAC encoder, sent through the route's Scribe module and joined by the route's merge.

| Take                                         | Pieces | Cut F1 | Words wrongly cut | Mistakes left in |
| -------------------------------------------- | -----: | -----: | ----------------: | ---------------: |
| 6.4 minutes, long plan                       |      1 |  1.000 |                 0 |                0 |
| 21.6 minutes, long plan (600 s, 5 s overlap) |      3 |  0.998 |                 0 |               24 |
| 21.6 minutes, 600 s pieces with 30 s overlap |      3 |  0.992 |                78 |               81 |
| 21.6 minutes, one request                    |      1 |  0.998 |                 0 |               36 |

Four runs each on the first two rows, six on the others. The wider overlap is worse: it gives the merge more of two renderings of the same speech to interleave.

On the long plan Scribe bills the audio once instead of 1.2 to 1.33 times, about $0.004 a minute with keyterms. A ten minute take is one request instead of seven, which matters on an ElevenLabs account limited to a few requests at a time.

### Scribe and the speech coverage check

The app runs an independent speech detector over each take, and the route treats detected speech with no words on it as missing: it retries those moments with Deepgram on short windows, and refuses the transcript if they stay uncovered. Scribe ends its words earlier than Deepgram, so the check was run against Scribe's transcripts to see whether it would start flagging them.

| Transcript                             | Uncovered ranges over the five takes | Seconds uncovered |
| -------------------------------------- | -----------------------------------: | ----------------: |
| Scribe, one request                    |                                    0 |               0.0 |
| Scribe, 120 s pieces through the route |                                    0 |               0.0 |
| Deepgram, 15 s pieces                  |                                    2 |               0.7 |
| Production pipeline                    |                                    2 |               0.6 |
| Deepgram, one file                     |                                   21 |              22.4 |

Scribe leaves nothing for the recovery passes to do on these takes. The app still uploads the short recovery windows for every stretch of speech, which is more audio than the take itself. With Scribe first they are spent only if Scribe fails and the take falls back to Deepgram. Not uploading them would cut the upload by more than half; it would also leave a fallback take with no way to repair what Deepgram drops, so that was left as it is.

### What ElevenLabs charges, and the free plan

The account behind `ELEVENLABS_API_KEY` is on the free plan, which allows 10,000 credits a month. The API reported a ten minute piece as 667 credits, or 800 with keyterms, so the free plan covers about two and a half hours of audio a month. This eval used nearly all of it on November 13: 355 credits were left.

ElevenLabs' API pricing page says API usage is billed in dollars and lists Scribe v2 at $0.20 an hour, with keyterms $0.05 an hour more, on six tiers that include 4.5, 30, 110, 495, 1,495 and 4,950 hours. The page does not name the plan each tier belongs to. Thirty hours at $0.20 is $6, which is the price of the Starter plan, so the tiers look like the paid plans' monthly fee spent at $0.20 an hour. Production use needs a paid plan either way. The page does not state a limit on parallel batch requests.

### List prices, read from the vendors' pages on November 13

| Provider                     |                                             Batch price per minute | Word timings                   | Key in `.env.local` |
| ---------------------------- | -----------------------------------------------------------------: | ------------------------------ | ------------------- |
| xAI speech to text           |                                            $0.0017 ($0.10 an hour) | yes, returned by default       | no                  |
| AssemblyAI Universal-2       |                                            $0.0025 ($0.15 an hour) | not stated on the pricing page | no                  |
| ElevenLabs Scribe v2         |     $0.0033 ($0.20 an hour), keyterms $0.0008 more ($0.05 an hour) | yes, tested                    | yes, free plan      |
| AssemblyAI Universal-3.5 Pro |                                            $0.0035 ($0.21 an hour) | not stated on the pricing page | no                  |
| Deepgram Nova-3              | $0.0043, keyterms $0.0013 more. The page labels this promo pricing | yes                            | yes                 |
| Scribe v2 through Surplus    |                                $0.0100 list, about $0.0037 settled | no                             | yes                 |

Groq's pricing page shows no model prices and OpenAI's returned a 403, so neither is in the table. There is no OpenAI key in Yapper's `.env.local`.

xAI is still worth a key. It lists at half of Scribe's price and 40% of Deepgram's, its documentation says it returns word times with a confidence value, keeps filler words when `filler_words` is set and takes up to 100 keyterms. Its text, heard through Surplus on a single file, dropped about as few words as the production pipeline does with all of its passes. Its word times are untested, because Surplus strips them and there is no xAI key.

## 1-Click Edit model

Twenty models on Surplus were given the production prompt and contract on the five takes. Runs differ per model because the batch was stopped once the ranking was clear.

| Model                         | Runs | Usable answers | Cut F1 | Words wrongly cut | Mistakes left in | Kept text error |         Seconds | List cost per edit |
| ----------------------------- | ---: | -------------: | -----: | ----------------: | ---------------: | --------------: | --------------: | -----------------: |
| gemini-3.7-flash (production) |    6 |           100% |  0.999 |                 6 |                0 |            0.9% |              17 |            $0.0030 |
| gemini-3.8-flash              |    6 |           100% |  0.999 |                 6 |                0 |            0.9% |              17 |            $0.0033 |
| claude-sonnet-5               |    4 |           100% |  0.998 |                 1 |                4 |            1.1% |              20 |            $0.0498 |
| gemini-3-5-flash              |    7 |           100% |  0.998 |                 4 |                8 |            1.1% |              16 |            $0.0061 |
| gemini-3-6-flash              |    7 |           100% |  0.990 |                25 |               27 |            2.3% |              17 |            $0.0176 |
| claude-haiku-5.5              |    7 |           100% |  0.978 |                17 |              111 |           10.7% |              10 |            $0.0014 |
| gpt-6-luna                    |    7 |           100% |  0.963 |                87 |               87 |            5.6% |              18 |            $0.0012 |
| gpt-5.6-luna                  |    6 |           100% |  0.957 |                90 |               88 |            5.7% |              18 |            $0.0054 |
| gpt-5.4                       |    7 |           100% |  0.954 |                27 |              191 |           22.0% |               2 |            $0.0072 |
| gpt-6.1-terra                 |    7 |           100% |  0.943 |               128 |              137 |            5.8% |               7 |            $0.0051 |
| mimo-v2.6-flash               |    6 |           100% |  0.939 |                26 |              223 |           26.7% |               6 |            $0.0008 |
| grok-4.3                      |    7 |           100% |  0.931 |               126 |              160 |           11.0% |               6 |            $0.0067 |
| gemini-3.1-flash-lite         |    7 |           100% |  0.929 |                67 |              291 |           30.5% |               2 |            $0.0010 |
| gemini-3-5-flash-lite         |    7 |           100% |  0.925 |                88 |              190 |           19.5% |               1 |            $0.0012 |
| kimi-k2.5                     |    4 |           100% |  0.902 |               122 |              110 |            8.2% |              20 |            $0.0077 |
| gpt-5.4-mini                  |    7 |           100% |  0.170 |                15 |            2,075 |            237% |               1 |            $0.0024 |
| glm-5.3-flash                 |    6 |            50% |  0.997 |                 2 |                3 |            1.4% |              12 |            $0.0003 |
| deepseek-v4.1-flash           |    5 |            40% |  1.000 |                 0 |                0 |            0.0% |              20 |            $0.0091 |
| muse-ember                    |    5 |            20% |  1.000 |                 0 |                0 |            0.0% |              18 |            $0.0041 |
| qwen3.8-flash                 |    3 |             0% |        |                   |                  |                 | timed out at 90 |                    |

F1 and the counts are over usable answers only. An unusable answer is one the production reader rejects, so production would retry it.

On the dense 14 minute take, gemini-3.7-flash and gemini-3.8-flash scored 0.973 with a kept text error of 1.5% when they answered, and each returned an empty answer on one call of two. gemini-3-6-flash scored 0.963 and gpt-6-luna 0.939. claude-sonnet-5, claude-haiku-5.5, gemini-3-5-flash and glm-5.3-flash all ran out of the 8,000 token allowance and returned nothing usable.

The production model is the right one. Nothing cheaper cuts as well, and the edit already costs $0.003 at list on a take of this length. The only model that is both cheaper and as accurate when it answers is glm-5.3-flash, at a tenth of the price, and half of its answers were unusable because it spent the token allowance thinking. It would be worth one more test with a larger allowance. The saving available is about a quarter of a cent an edit.

The models that fail do so in the same way: they keep an earlier attempt alongside the final one. That is the "mistakes left in" column.

## What Surplus charges

From `GET /v1/buyer/me` on the account, lifetime, across every product that uses it: 62,095 requests, $1,280.99 at list, $147.15 paid. That is 88.5% off.

| Model                   | Requests |    List |   Paid |           Discount |
| ----------------------- | -------: | ------: | -----: | -----------------: |
| gpt-5.5                 |    7,443 | $770.75 | $37.07 |                95% |
| gpt-5.4-mini            |   14,769 |  $86.82 | $11.20 |                87% |
| gpt-5.4                 |    1,087 |  $25.81 |  $5.11 |                80% |
| claude-opus-4.7         |      153 |  $11.23 |  $2.60 |                77% |
| venice-gpt-image-2      |       35 |   $9.69 |  $2.91 |                70% |
| gemini-3.7-flash        |      216 |   $2.65 |  $0.32 |                88% |
| venice-whisper-large-v3 |      286 |   $1.86 |  $0.57 |                70% |
| elevenlabs-scribe-v2    |    1,207 |   $1.72 |  $0.64 |                63% |
| claude-haiku-5.5        |    3,245 |   $1.69 |  $0.88 |                48% |
| gemini-3.1-pro          |      222 |   $6.38 |  $7.06 | 11% more than list |

The discount is real and uneven. It is deepest on OpenAI's large models and thinnest on the cheap ones, and one model cost more than list.

The thumbnail model is `venice-gpt-image-2` through Surplus, at $0.28 a picture at list and $0.08 paid. The thumbnail is charged 12 credits.

## Provider keys

Yapper sends every Surplus call through one key, named `yapper-ai-cleanup` in the dashboard, so the dashboard cannot say what editing cost against overlays or ideas. The key is read as `process.env.SURPLUS_API_KEY` in 42 places.

## Not tested

- xAI's word times, for want of a key.
- Scribe on a real take longer than 6.4 minutes (the 21.6 minute take is five takes joined), and with a creator's own dictionary terms. The route test sent only the two default terms.
- The Mac app end to end against a service with the flag on. The app's encoder output, the route's module and merge, and the plan endpoint were each tested; the request between the app and a live service was not.
- The route itself against a running server. The module and the merge were run on real audio; the request handling around them is covered by unit tests.
- The same comparisons on a phone recording, a lavalier or a noisy room.
- What production really bills Deepgram per minute of footage. That needs Deepgram's usage export set against `edit_runs`.
- Overlay design on a cheaper model than claude-opus-4.7.
