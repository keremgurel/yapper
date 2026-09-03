# Chirpy overlays: integration state

Status as of 2026-09-04. Everything below is in the working tree, uncommitted.
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

Automated: 1,416 backend tests across 189 files and 1,140 native tests across
168 suites pass. TypeScript, ESLint and `git diff --check` pass.

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

Production deployment `dpl_35bby4iyaLeQQPAat9yShtSh52nN` (2026-09-04) carries
everything in this document: the editorial review, quote normalisation, word
timings, the schematic rule and the full-frame fix. The three routes answer
JSON 401 to unsigned requests and the first minutes of runtime logs are clean.

Word timings were checked against the same designer the route runs: a counter
moment whose "now" value is spoken at 4.2 s of a 6.5 s overlay came back
holding 324 until 3.7 s (the end of "Now") and climbing to 553 by 4.9 s, the
end of the spoken "553". Frames rendered from the native poster path at 2.8 s
and 5.0 s show 324 with no bar, then 553 with the bar and "+229". They are in
`/tmp/yapper-timing-review/`. What has not been done is watching that reveal
inside the installed app against a real recording; the mechanism is verified,
the feel of it in playback is not.

## Running the live evaluations

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
