# ep12 transcription audit — 2026-09-11

The automatic recovery follow-up below is the current implementation. Its
review copy, `ep12 complete takes.yapperproj`, supersedes the earlier copies.

The saved transcript was incomplete. The earlier edit repair preserved the
cleaner's choices but inherited omissions already present in that transcript.
The new review copy supersedes `/private/tmp/ep12-repaired.yapperproj`.

## What was checked

- The original DJI audio track was copied without re-encoding and transcribed
  in one request to the existing Deepgram Nova-3 provider.
- The native PCM conversion, 120-second/30-second-overlap chunk planner, and
  160 kbps AAC encoder exported seven chunks from the same source. Fresh ASR
  responses were merged using the production `mergeAsrChunks` function. They
  reproduced all 1,111 saved word tokens, ignoring punctuation and case.
- All seven provider durations matched their expected lengths within codec
  tolerance. This incident was not a truncated upload.
- The waveform was checked for substantial sound inside transcript gaps.
  Fourteen short lossless excerpts covering those gaps were transcribed,
  plus focused excerpts around 70 and 110 seconds. Eight excerpts were also
  checked with the existing Whisper fallback. Whisper itself suppressed
  several restarts, so it was not treated as ground truth.
- A lossless 90–210-second excerpt still omitted the repeated line at 120
  seconds. Short excerpts recovered both attempts. Changing only the codec
  therefore does not fix this case.

## Recovered passages

Times below are source times, not edited timeline positions. Six bounded
regions were repaired in a separate project, adding 50 words net:

| Source region | Added words | What the saved transcript missed                                                        |
| ------------- | ----------: | --------------------------------------------------------------------------------------- |
| 98–108 s      |           5 | Words inside the repeated “It's been a month and twenty days since I…” attempts         |
| 116–126 s     |           8 | A second “And I only held off on paid ads” starting near 120 s                          |
| 158–178 s     |           8 | Two additional “and after I launched” restarts, around 161 and 171 s                    |
| 255–267 s     |          18 | The end of one hiring-list attempt and the beginning of the next                        |
| 409–415 s     |           3 | A second “I already hired”                                                              |
| 552–558 s     |           8 | Another “now it's just maintenance work and adding new” before “questions where needed” |

These omissions made separate attempts look like one sentence with a pause.
The edit could then retain an earlier prefix, cut the untranscribed restart
as a pause, and append the later suffix. A cleaner cannot select an attempt
whose opening is absent from its input.

The repaired transcript contains 1,161 words. The cleaner was rerun against
that transcript. Its choice now starts the paid-ads sentence near 120 seconds
and the final maintenance sentence near 554 seconds. One contiguous “and”
before “after I launched” was restored during transcript review because the
model omitted that connector. The native replay verifies the selected words,
caption membership, and that the transcript flow includes cut takes too.

## System findings and changes

The transcript tab reads all stored words for media on the timeline, including
rejected takes. These passages were absent from the stored ASR output itself;
the tab was not hiding them. Neither the overlap merger nor the native repeated
emission filter can recover words neither overlapping ASR pass returned.

Two transport safeguards were missing independently of this incident:

1. A complete final chunk could hide an earlier truncated chunk because only
   aggregate duration was considered. Every stored chunk is now checked against
   its own expected decoded duration. Missing duration metadata also fails that
   check when the client supplied a duration. The existing fallback/refund path
   handles failure rather than returning partial text.
2. Upload plans could start after zero or leave gaps between chunks. Such plans
   are now rejected before billing or provider calls.

Five new failing route regressions reproduced those holes; all 42 focused
route/merge/truncation tests pass after the fixes. TypeScript checking and
targeted lint pass.

## Earlier limitation (superseded by the follow-up below)

A whole-recording 30-second/10-second-overlap experiment recovered many omitted
restarts, returning 1,152 words. It still missed the maintenance restart and
introduced other errors, including dropping “well” from “worked quite well”.
It was not promoted as the production default.

The automatic ASR path still needs targeted coverage recovery, followed by
checks that recovery neither removes existing speech nor creates duplicates.
Duration checks prevent truncated chunks; they cannot detect an ASR model
silently omitting speech from audio it decoded completely. The current
two-minute settings remain unchanged. These repairs are a source-window audit,
not an independent human verbatim transcription or a claim of zero remaining
word/spelling errors. Proper names and other ambiguous wording remain subject
to review.

## Local artifacts

- Saved review package:
  `~/Movies/Yapper Projects/ep12 transcript audited.yapperproj`
- Replay output: `/private/tmp/ep12-transcript-audited.yapperproj`
- Source and native ASR evidence: `/private/tmp/yapper-ep12-asr-audit/`
- Short-window experiment: `/private/tmp/yapper-ep12-asr-short/`
- Repair provenance: `transcript-repairs.json` in the evidence directory
- Cleaner response and replay fixture: `audited-cleaner-response.json` and
  `audited-cleaner-fixture.json` in the evidence directory

The original project is unchanged. No app release or backend deployment was
performed. The review package still references the original mounted media.

## Automatic recovery follow-up — 2026-09-11

The implementation now includes automatic recovery. The original unresolved
section above records the earlier investigation, not the current code state.

### Why the screenshot showed a false pause

Nova-3 returned the opening at 116.88–118.90 s, omitted the repeated opening
near 119.92 s, then resumed with “until” at 121.63 s. Neither formatting on/off
nor successful chunk duration validation restored that opening. The stored
text therefore combined two deliveries before the editor ever chose takes.
The editor then compounded this by cutting all wordless gaps, even loud ones.
An existing native test explicitly required that unsafe behavior.

### Implemented pipeline

1. Decode the source at its native rate. Keep 120 s / 30 s overlap for the
   main vocabulary/context pass.
2. Independently run Apple's built-in SoundAnalysis speech classifier, using
   0.5 s windows, half overlap, confidence >= 0.6, and the central half of
   each classified window. This detects acoustic speech independently of ASR;
   it is not a transcript and does not certify recognition accuracy.
3. Prepare 10 s recovery excerpts with 4 s overlap around detected speech.
   Batch their signed upload tickets so one recording consumes one upload
   rate-limit token. Encoding and uploading use bounded concurrency and
   temporary files; provider calls use bounded concurrency and one deadline.
4. Compare recognized word intervals against independently detected speech,
   allowing 120 ms timestamp tolerance. Uncovered intervals >= 250 ms trigger
   short-context Nova-2 recovery. A second pass uses another overlapping
   excerpt and Nova-3. Existing Groq fallback remains available.
5. Reconcile recovery by time and token. Preserve previously recognized words
   and their spelling; add omitted speech and refine matching timestamps.
   Never replace the entire transcript with a short-window transcript.
6. Recheck coverage. If speech remains uncovered, return
   `transcription_incomplete`, refund the reservation, delete uploaded excerpts,
   and leave the edit unchanged. New native clients require the server's
   coverage acknowledgement and cannot silently accept an older response.
7. Revision 4 invalidates cached revision-3 transcripts before one-click edit.
8. Trim measured silence and explicit retake cuts. A wordless gap by itself
   no longer authorizes removing audio, including when audio cannot be read.
9. Both chunk merging and native duplicate filtering require substantial
   temporal overlap for identical-word deduplication. Tiny timestamp overlaps
   must not erase real repetitions such as “that that”.
10. Validate repeated-take openings after cleanup. If the model clips a word
    directly attached to a retained repeated phrase, ask it to correct the
    decision. Refuse/refund if the boundary remains invalid. This does not
    automatically restore arbitrary words the model rejected.

### Recording evidence

The acoustic check identified ten uncovered speech regions in the original
1,111-word transcript and correctly excluded the outdoor noise near 423 s.
Ten first-pass recovery calls and one second-pass call produced 1,163 words,
with no remaining detected coverage gaps. All original tokens survived in
order. The complete paid-ads delivery runs from approximately 119.92 s through
125.39 s; both attempts remain available in the transcript tab.

A cleanup run also clipped “Now” from the final maintenance delivery. The
new boundary validator caught index 1092; corrective requests restored it.
Three live complete cleanup evaluations accepted 426 words, including both
complete sentence openings. No manual word or keep-span patch was applied.

The actual native source/audio replay passed: 1,163 transcript words remain
available, all 426 selected words survive trimming and have captions, and
native duplicate filtering preserves the recovered transcript. The new review
copy is `~/Movies/Yapper Projects/ep12 complete takes.yapperproj` (34 clips,
110.24 s). The original project remains byte-for-byte unchanged.

### Limits of the guarantee

These checks make detected missing speech, incomplete uploads, and detected
clipped take openings explicit failures instead of silently damaged edits.
ASR and acoustic classification still use statistical models. Coverage does
not establish perfect spelling, correct numbers, every quiet syllable, or
human-level editorial correctness. This recording and regression cases are
not a certification for every future microphone, language, or noise condition.
The user-supplied full paid-ads sentence is an exact content regression; other
wording is not independently human-transcribed ground truth.

The source fixture is `src/lib/transcription/fixtures/ep12-coverage.json`.
Local live evidence and automatic replay artifacts use `/private/tmp/ep12-*`.

### Rollout

The scoped backend release was built from the exact previously deployed source
(`dpl_4wJexq9ALx1TH9gStUapuVJMsCkp`), preserving the deployed versions of four
Poster files that differ from the current workspace. Only eight transcription
and cleanup implementation files were overlaid. The production build and type
check passed, and deployment `dpl_97cKR4ZtYQN3hqW1BpYJVizhvqLi` was promoted.

The signed release build was installed at
`/Applications/Yapper Studio Native.app`. Its predecessor is preserved at
`~/Library/Application Support/Yapper Studio/Backups/editor-before-transcription-recovery-20260911.app`.
The installed executable matches the packaged executable. A live app-level
one-click run completed successfully in `ep12 pipeline check.yapperproj`. It
returned 1,163 words, kept 426, produced 34 clips, and captioned every kept word.
The paid-ads delivery survives in one source clip (119.984–125.390 s), and the
final maintenance opening includes “now”. The saved result was copied to
`ep12 complete takes.yapperproj` for review; no transcript or cut decisions
were manually patched. The original project remains unchanged.

Validation: 90 focused server tests passed; the broader native selection passed
106 tests, followed by 27 targeted native checks including the real audio
speech-classifier test and the complete source-to-caption replay. TypeScript,
targeted ESLint, and diff whitespace checks passed. These sets overlap and
should not be added together as a unique test count.
