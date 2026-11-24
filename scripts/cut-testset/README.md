# Cut test set

Twenty-four messy takes with a known correct cut, for checking 1-Click Edit on voices and recording conditions other than the ones it was tuned on. It feeds the existing harness in `scripts/asr-eval/` and `scripts/clean-eval/`.

## What a take is

Six short scripts written for the set (`monologues.mjs`), each recorded four times. `plan-take.mjs` turns a clean script into a recording session: a line said two or three times, a false start, a stumble and an apology, a reworded retake, a second attempt that is abandoned, a long silence, and one line that repeats on purpose for emphasis and has to survive. Every piece is labelled keep or drop when it is planned, so the answer key is exact and nobody judges it by ear.

`takes.mjs` assigns each take a voice and a condition. The voices are the Mac's built-in ones, eight of them across US, UK, Australian, Irish, South African and Indian accents. The conditions are clean, a phone microphone (narrow band and compression), a noisy room (room tone and echo) and a fast, quiet talker.

## Running it

```bash
node scripts/cut-testset/synth.mjs .cut-testset-work
```

```bash
bash scripts/cut-testset/run.sh .cut-testset-work r1
```

```bash
node scripts/cut-testset/report.mjs .cut-testset-work r1
```

`synth.mjs` needs macOS `say` and ffmpeg and costs nothing. `run.sh` transcribes every take with Deepgram Nova-3 and ElevenLabs Scribe, then runs the production edit model on each transcript twice. It needs the provider keys in `.env.local`. Set `CUT_MODEL` to try another edit model.

The work folder is ignored by Git. Rebuild the audio from the scripts at any time.

## First run, November 22, 2026

Production edit model (gemini-3.7-flash), two runs per transcript, 96 cuts and 384 scripted lines per transcriber. A cut is perfect when every line has exactly one good delivery kept and nothing else.

| Transcriber       | Perfect cuts | Lines wrong |
| ----------------- | -----------: | ----------: |
| Deepgram Nova-3   |     30 of 48 |   18 of 384 |
| ElevenLabs Scribe |     41 of 48 |    7 of 384 |

Every retake was handled on every voice and in every condition: lines said two or three times, false starts, stumbles with an apology and abandoned second attempts were all cut correctly, 192 of 192 for each transcriber. A reworded retake kept the weaker wording twice with Deepgram and never with Scribe.

All the other errors are one thing: a line that repeats on purpose for emphasis was cut as if it were a retake. Two lines account for nearly all of it, and both have a second sentence that contains the first.

- "That is normal. That is completely normal." lost its first sentence in 8 of 8 runs with Deepgram and 7 of 8 with Scribe.
- "Taste the water. Yes, taste the water." was cut in 7 of 8 runs with Deepgram, which hears it as "Taste the water. Yes. Taste the water.", and in none with Scribe.

"It works. It really works.", "Small is fine. Small is the point." and "Three, not ten. Three is the whole trick." were never cut.

Accent and recording condition made no difference beyond which script a voice happened to read.

The long take (`long-clean`, 6.8 minutes, 48 lines, three runs per transcriber) came back with no line wrong in any usable answer. One of the three Scribe answers was rejected by the production reader, which production retries.

An earlier version of the long take delivered every script twice. The edit model removed the first full delivery of each, minutes before the second, as a retake of the whole thing. That is the behaviour a creator re-recording a section wants, and it means a point repeated on purpose later in a long video will be cut.

## Run in the Mac app, November 23, 2026

1-Click Edit was run from the button on a 24.6 minute take (2,891 words, about 92% of it retakes) in a project with no transcript and no cuts. The stage times come from the app's own latency log (`/usr/bin/log stream --predicate 'subsystem == "com.yapper.native"' --info`).

| Stage                                      | Measured  | What the progress bar expected |
| ------------------------------------------ | --------- | ------------------------------ |
| Transcribing                               | 52 s      | 324 s                          |
| Removing mistakes and retakes              | 190 s     | 43 s                           |
| Cutting pauses, trimming silence, captions | under 1 s | 93 s                           |
| Whole run                                  | 4 min 2 s | 7 min 40 s                     |

Transcription split into 11 s reading the audio out of the 11 GB file, 4 s encoding 255 pieces, 31 s uploading 104 MB and 5 s waiting for the words. The upload is about three times the take's audio, because the recovery windows are sent alongside the main pieces.

The retake step is one model call that reads the whole take, and on a take this long a call takes about 60 seconds. Timed directly afterwards with the production request, seven calls gave two usable answers. Three ended with `finish_reason: "length"` at the 8,000 token cap, which the route treats as a failure and does not retry. Two came back empty with `finish_reason: "tool_calls"`, which the route retries. The 190 seconds in the app is consistent with two empty answers followed by a good one.

The harness used to time a call up to the response headers, which arrive after about 20 seconds whatever the model is doing. That is where the earlier "20 seconds per call" came from. `surplus.mjs` now times the whole answer and records the header time separately.

Against the finished edit of the same take, the fresh cut kept one four word sentence the finished edit does not have, dropped one short phrase it does have, and on two lines chose an earlier take where the finished edit uses the last one. A direct run on the same transcript the day before differed on one take. The model does not return the same cut twice on a take this dense.

### After the retake fix (#362), same day

The route now sizes the token cap to the take (16,000 for this one), sends the kept-spans schema, and asks again with more room when an answer is cut off. 1-Click Edit was run again from the button on the same project, against production, with the transcript reused. The retake step took 111 seconds and needed one call, against 190 seconds before.

The cut came back as 32 clips and 2:05. Against the finished edit it differs in two places. It kept a one second fragment at 1:07, and it took one line from 16:26 where the finished edit uses the take at 16:07. This is one run.

The app's progress bar still expected 43 seconds for this step. keremgurel/yapper#363 changes the estimates to the measured times: 115 seconds for this take's retake step, 52 for transcribing it, and 2 each for the steps after. A third run with that build took 131 seconds for the retake step and returned the same cut, fragment included. The bar was about a third full at 42 seconds and about two thirds at 1 minute 39.

### The fragment at 1:07

The fragment was a whole sentence of four words with its last word clipped by the silence trim. It was said once, straight after a line that was then recorded again, so the model kept it as an idea said only once, and it played in front of the retake of the line it had followed. All three saved answers on the app's transcript kept it. On Deepgram's and Scribe's transcripts of the same take the model chose differently at that spot and the cut was coherent, so this depends on the transcript.

The route now cuts that case itself (`src/lib/studio/retake-stranded-spans.ts`). It looks for a kept sentence of 2 to 12 words, cut on both sides, that was not said before and sits between a dropped line and the kept retake of that line. It adds no model call.

A looser version also took a sentence that runs straight into the retake. That one fired on six answer keys, each time on the first sentence of a passage recorded again from the top, which has to stay. The version in the route fires on none of the 59 answer keys or the nine finished projects. On 107 saved model answers it fires three times, all on this sentence.

Sent through the route on localhost (signed in with local fake auth, a throwaway database, the real provider), the app's transcript came back with the sentence cut and no other difference from the finished edit, word for word. The request took 190 seconds. This is one run.

## What it does not test

The voices are synthetic. They read every word clearly, so the set does not test mumbling, breathing, laughing, trailing off, or two people talking, which is where a transcriber drops the restart that hides a retake. It tests the edit model's judgement across accents and audio quality, and a transcriber's robustness to that audio.

It does not test how tight the cut feels. The harness scores which words are kept. The pauses between kept lines are trimmed later by the Mac app.

Deepgram here is one request per take. Production adds overlapping pieces and recovery passes, so production Deepgram should do at least this well.

## Testing a real video

Finish editing a video in the Mac app, then:

```bash
bash scripts/cut-testset/run-real.sh .cut-testset-work ~/Movies/"Yapper Projects"/"My video.yapperproj"
```

The finished edit is the answer key. The script takes the original recording and the app's transcript out of the project, transcribes the recording again with Deepgram and Scribe, runs the edit model twice on each of the three transcripts, and prints every phrase the model cut that the finished edit kept and every phrase it left in that the finished edit removed, with its time in the recording. That list is where a stray mumble shows up.

A project that was started with 1-Click Edit favours the app's own transcript, because the finished edit began as that cut. The fairest test is a video cut by hand, or one whose 1-Click result was then corrected carefully.

`long-clean` is one synthetic take of about seven minutes: all six scripts back to back. Build it with `node scripts/cut-testset/synth.mjs .cut-testset-work long-clean`.
