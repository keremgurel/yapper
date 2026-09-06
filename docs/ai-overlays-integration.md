# Chirpy overlays: integration state

Status as of 2026-09-05. The base feature is committed; the revision changes
described below are in the working tree.
The plan is `ai-overlays-plan.md`; the scene language and wire formats are
`overlay-scene-format.md`. This file says what actually exists, what has been
verified, and what has not.

## What a creator can do

In the native editor, Chirpy takes "create an animation for the moment I say
X" or "add overlays where they would improve the video". If the project has no
transcript it transcribes first. There is no proposal step: it picks the
moments, fits a box around the face, captions, on-screen text and existing
overlays, designs each visual for that box, saves it to Media, and puts it on
an overlay lane in one undo step.

Media shows the name, a one sentence description, the poster and the quote.
Mentioning the asset with `@` restyles it, moves it to another spoken moment,
uses it again, or removes it. A restyle changes every instance because they
share one asset; a move targets the instance nearest the playhead; removing
from the timeline keeps the asset in Media. Every version is an immutable file
under `generated/<id>/` inside the project package, so ⌘Z restores the earlier
design by pointing the media back at the earlier file.

Generated assets are overlay-lane assets only. They cannot go on the main
track, cannot be cropped, and cannot sit behind the speaker. Both preview and
export draw the same Core Animation tree from the same scene file.

## Backend

Native revisions now use `op: "edit"`. A short model contract interprets the
whole request and separates animation changes from timeline placement. The
previous client keyword shortcut could route a request containing "start" and
"where" to a move-only operation and discard the requested animation edit.
It has been removed. Design changes remain free-form; supported counter hold
edits shift existing animation segments directly, preserving the design and
transition lengths. Scene and placement changes share one undo transaction.

Three routes share one handler (`src/lib/studio/scene/route-handler.ts`):
`POST /api/direct-overlays`, `/api/design-overlays`, `/api/revise-overlay`.
They use the existing auth, bounded bodies, provider rate limits and credit
reservations, and are registered in the Clerk proxy matcher with a regression
test, since the shared handler hides its auth from the import scanner.

| Pass               | Model                                        | Credits                                    |
| ------------------ | -------------------------------------------- | ------------------------------------------ |
| Direct (editorial) | `AI_DIRECT_MODEL`, default `claude-opus-4.7` | 1                                          |
| Design             | `claude-opus-4.7`                            | 2 per moment, plus 2 per generated picture |
| Revise (restyle)   | `claude-opus-4.7`                            | 2                                          |
| Revise (retime)    | `AI_PLACE_MODEL`, default `gpt-5.4-mini`     | 1                                          |

`AI_OVERLAY_MODEL` overrides all of them. Claude calls omit `response_format`,
which the gateway does not support for it; the reply is still required to be
JSON. Pictures use the existing `GEMINI_API_KEY` path. Brand colours and the
primary logo come from the active workspace kit. Failed designs are refunded.
Rate limits: direct 4 burst and 20 an hour, design 12 burst and 60 an hour
(the native client sends one design request per moment), revise 6 and 40.

A revision from the app now arrives as `op: "edit"`: one small planning call
turns the sentence into operations (an opening hold in seconds, a scene
instruction, a total duration, a placement quote or a relative shift). A hold on
a counter is applied arithmetically to the saved scene, with nothing regenerated;
anything else goes to the designer with the planned instruction; a move alone
returns `sceneChanged: false` and the app retimes the instance itself. Edits
that never reach the designer are refunded down to the retime price. The older
`restyle` and `retime` ops still work for the previously installed app.

The direct pass is reviewed before it is returned (`direct-checked.ts`): an
internal editorial and factual check that drops weak decorative ideas, keeps
personal story moments free of graphics, and rejects claims the transcript
does not support. It is internal; the creator still sees no proposal step.

## Quality gates

Text is never silently enlarged. That broke layouts: the earlier validator
raised undersized fonts without recomposing, and words overlapped. Now the
validator only notes an undersized text, and the backend runs up to three
bounded repair attempts inside the same paid action when a draft fails
layout checks (legibility, text allocation, counter width, simultaneous text
collisions, bounds, requested motion). The native app checks real font
metrics and sampled animation geometry before saving. Unreadable drafts do not
reach the timeline.

Charts with numbers are claims about data. Both prompts now separate a
schematic (a relationship the speaker described, drawn with no axis values and
qualitative labels) from a chart of stated figures, and forbid inventing
intermediate data, testimonials, screenshots, chat messages or platform UI.
Counters animate from the stated earlier value, not from zero.

Swift's JSON bridge used to read numeric `0` and `1` as booleans and drop
animation values; validation now tells CFBoolean apart by type id, with a
round-trip regression test.

A generated scene whose aspect happens to match the video no longer trips the
solver's full-frame bypass. `OverlayLayout.solve` takes a `fullFrame` policy,
generated overlays pass `.never`, and the "Add as overlay" path from Media does
the same. Tested in `GeneratedOverlayFullFrameTests`.

## Verified

Automated: 1,422 backend tests across 190 files and 1,155 native tests across
170 suites pass. TypeScript, ESLint and `git diff --check` pass.

2026-09-05 revision checks in the rebuilt, installed app: the creator's exact
"hold the old numbers for 3 seconds" request saved v3, extended the scene from
4.2 to 6.5 seconds, and extended its trimmed timeline instance from 4.063 to
6.363 seconds. Preview inspection showed 324 / 17 at 9.90 seconds, intermediate
values at 11.33, and 553 / 28 at 12.80. Undo restored v2 and the original duration;
redo restored both changes. A follow-up explicitly preserving placement kept
the start at 7.410 seconds and did not add another hold. Scene nodes matched the
original exactly. The original project was not revised; the persistent copy is
`~/Movies/Yapper QA/2026-09-04/revision/Overlay QA copy.yapperproj`.

The full GUI export completed at 1728×3072, 99.833 seconds, with audio. Exported
frames at 8.0 and 10.3 seconds show 324 / 17, at 10.7 and 11.33 show intermediate
values, at 12.8 show 553 / 28, and at 14.1 show the overlay gone. Evidence and a
short playback clip are in `~/Movies/Yapper QA/2026-09-05/revision/`:
`Chirpy timing verified.mp4`, `Chirpy timing preview.mp4`, and `frame-*.png`.
Both paid model evaluations (original wording and explicit unchanged placement)
also pass, with their plans saved alongside the export.

On the final build and deployment, a free-form color revision changed only the
two number nodes to blue. Labels, background, geometry, total duration, timeline
placement, and animation segments were preserved (numeric comparisons allow
floating-point serialization precision). It was undone to leave the verified
orange version in the QA project. The project and generated asset also survived
an app restart.
A placement-only request moved the overlay exactly one second earlier without
creating a new asset version or changing its duration; undo restored its start.

Live, with paid models, in the installed app on a copy of the `ep11` edit:
generation from an exact request landed one named counter asset at the
transcript-anchored moment, clear of captions; `@` restyling, retiming, reuse
and removal each worked and each undid with ⌘Z; the asset survived relaunch;
mention suggestions narrow to generated assets; a full 100 second export at
1728×3072 showed the counter entering, counting, holding and leaving on the
right frames; Brand is visible under Settings.

Reviewed offline: a paid-versus-organic request produced a two panel schematic
(red line climbing then collapsing, green line stepping up as Reddit, SEO and
videos land) with no numbers on it, rendered from the native poster path at
the design box size. Frames are in `/tmp/yapper-organic-review/`.

## Deployed

Production deployment `dpl_58m8w2V8zJYfHso8nCveoJfc3PhM` (2026-09-05), verified
Ready and aliased to `ypr.app`, carries the semantic revision planner and the
partial credit refund for edits that do not need the designer. The installed
app was rebuilt and replaced on 2026-09-05 to use that operation.

Word timings were checked against the same designer the route runs: a counter
moment whose "now" value is spoken at 4.2 s of a 6.5 s overlay came back
holding 324 until 3.7 s (the end of "Now") and climbing to 553 by 4.9 s, the
end of the spoken "553". Frames rendered from the native poster path at 2.8 s
and 5.0 s show 324 with no bar, then 553 with the bar and "+229". They are in
`/tmp/yapper-timing-review/`. What has not been done is watching that reveal
inside the installed app against a real recording; the mechanism is verified,
the feel of it in playback is not.

## Running the live evaluations

### Visual inspection and automatic repair (local, not deployed)

Chirpy now receives sampled frames of the actual edited video, edited-timeline
word timings and waveform peaks. The director sees eight overview samples;
each designer gets a targeted interval. Independent moments are designed in
batches of three, with placement reservations and stable response-ID matching.

After creation or revision, the native editor exports the affected interval
through the real compositor and caption pipeline. `/api/review-overlay` checks
the resulting pixels for material defects. Up to two repairs create immutable
asset versions, followed by fresh renders and another review. Any repair causes
all affected instances to be checked again. Failure or cancellation restores
the previous project; successful changes remain one undoable edit. There is no
additional user approval step or template restriction.

Review evidence is bounded to eight JPEGs per request. Ranged exports preserve
animation clocks in both the single-pass and two-pass renderer. Repairs receive
the palette saved with the asset, not just today's brand settings. This is
sampled visual QA, not continuous playback, audio-quality verification or a
guarantee of subjective creative quality.

Live tests exercise real model calls, native sessions, rendering and automatic
repair. Their loopback backend mocks authentication, billing and rate limiting;
they do not verify production deployment. A real talking-head project was read
without modifying its saved source, and its exported counter frames were
manually inspected. A deliberately broken counter was repaired and its blue
324-to-553 output was also manually inspected.

Deploy the new backend endpoint before distributing the updated native app.
The deployment described above predates this inspection/repair work.

```sh
RUN_INTEGRATION_TESTS=1 RUN_OVERLAY_INSPECTION_LIVE=1 \
  OVERLAY_INSPECTION_OUTPUT=/absolute/scratch/output \
  node --env-file=.env.local node_modules/vitest/vitest.mjs run \
  src/lib/studio/scene/inspection-live.integration.test.ts
```

Add `OVERLAY_INSPECTION_BROKEN=1` to exercise automatic repair of a deliberately
incomplete counter. Outputs contain video/transcript evidence: keep them local.

### Earlier scene evaluations

They are opt-in and paid, and write only to a scratch folder.

```
RUN_INTEGRATION_TESTS=1 RUN_OVERLAY_LIVE_EVAL=1 OVERLAY_EVAL_OUTPUT=/tmp/out \
  npx vitest run src/lib/studio/scene/live-quality.integration.test.ts

RUN_INTEGRATION_TESTS=1 RUN_OVERLAY_LIVE_EVAL=1 OVERLAY_EVAL_OUTPUT=/tmp/out \
  OVERLAY_EDITORIAL_FILE=/tmp/some-run/editorial.json \
  npx vitest run src/lib/studio/scene/live-editorial-file.integration.test.ts

cd native-macos && OVERLAY_EVAL_OUTPUT=/tmp/out swift test --filter SceneLayoutQualityTests
```

The last command renders five frames of `scene.json` at the box the design was
made for (`box.json`) into the same folder. The tests read provider keys from
`.env.local` through `live-env.ts`, because Next's env loader skips that file
under NODE_ENV=test and the earlier runs failed as `no_provider` in a few
milliseconds without saying why.
