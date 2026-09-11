# ep12 one-click edit investigation

Follow-up: [the source-audio transcription audit](ep12-transcription-audit.md)
found 50 additional words missing from the input transcript. Its review package
supersedes the initial repaired copy described here.

Investigated 2026-09-11 using the project open in the native editor:
`~/Movies/Yapper Projects/ep12.yapperproj`, saved 2026-09-10 at 17:53:02 UTC.
Source: `DJI_20260910094407_0065_D.MP4` on `G Micro Pro`, 588.922 seconds,
1,111 transcript words. The original project was snapshotted before analysis
and verified byte-for-byte unchanged afterward.

## Confirmed failures

1. **Local finishing deleted a distinct idea after the cleaner selected it.**
   At source 205.185–206.870, words 389–397 say “some of it was a waste of
   time, and”. `KeptStreamRepair.withoutImmediateRepeats` mistakes the repeated
   opening “some of it was” in a three-part list for a restart and deletes the
   middle item. A regression using the exact clause reproduces the saved
   edit's nine missing words. Related regressions show the other heuristic
   passes deleting distinct sentences with similar openings and grammatical
   repetitions such as “that that” and “had had”.

2. **Word protection used the threshold for wordless noise.**
   `MeasuredSilence` narrowed words using the louder `livelyLine`, then allowed
   island absorption to delete the unprotected remainder. A quiet release
   after a small dip could therefore be removed despite clearing the silence
   detector's own threshold. The regression reproduces a cut at 0.370 seconds
   even though the word continues sounding until 0.600. On the real source,
   the corrected replay extends “first” from 125.280 to 125.390 seconds and
   “compounds” from 395.330 to 395.480 seconds.

The initial midpoint-based transcript inspection overcounted missing sentence
endings. The editor uses a 35% playback anchor because ASR word ends often
include silence. Those ending words still had captions; they were not all
deleted words. Word presence and audible release preservation are separate
checks.

## Fix and evidence

- The AI path no longer reruns broad text-similarity or repeated-word deletion
  rules over the model's chosen passages. Those remain in the local fallback.
  The existing narrowly defined stranded-connector rule remains.
- Word protection now uses the silence detector's threshold. The stronger
  threshold still handles wordless noise islands.
- Three fresh calls with the production prompt, model, and 8,000-token cap
  selected identical word sets, including all nine missing words. Latencies
  were 9.8, 10.9, and 12.7 seconds. The original response was not persisted, so
  these are reproductions, not a recovered log of the original request.
- The reference spans were reviewed against the transcript, not independently
  transcribed by a human. Agreement on these runs is not a zero-error accuracy
  claim about the source audio or all future recordings.
- 45 targeted Swift tests pass. Four new regression cases were observed failing
  before the fixes and passing afterward.
- `OneClickReplayDiagnostics` runs the full native finishing, original-media
  silence analysis, clip removal, and caption generation. It verifies all 426
  selected words survive and have captions. The saved project kept 417.
- The separate repaired package has 35 clips, 142 captions, and 108.080 seconds
  of playback, versus 35 clips, 139 captions, and 106.349 seconds originally.

The prior benchmark scored model decisions before native finishing and audio
trimming. It could therefore report a perfect decision while the actual editor
deleted words afterward. The new replay diagnostic covers those later stages.

## Local review artifacts

- Original snapshot: `/private/tmp/yapper-ep12-before.json`
- Transcript-reviewed spans: `/private/tmp/yapper-ep12-eval.json`
- Three provider responses: `/private/tmp/yapper-ep12-provider-results.jsonl`
- Repaired package: `/private/tmp/ep12-repaired.yapperproj`

Replay without writing a package:

```sh
cd native-macos
ONE_CLICK_REPLAY_PROJECT=/private/tmp/yapper-ep12-before.json \
ONE_CLICK_REPLAY_FIXTURE=/private/tmp/yapper-ep12-eval.json \
swift test --filter OneClickReplayDiagnostics
```

Set `ONE_CLICK_REPLAY_OUTPUT` to a new package directory to produce a review
copy. The diagnostic refuses to overwrite an existing directory. These local
artifacts require the original media to remain available. No release or
installed-app update was performed. Caption spelling, including proper names,
still comes from the existing transcript; these changes do not retranscribe it.
