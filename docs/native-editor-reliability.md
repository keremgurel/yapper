# Native editor reliability fixes

## Speech and editing

The ep12 investigation and recovery evidence are in
[ep12-transcription-audit.md](ep12-transcription-audit.md). Each uploaded chunk
must cover its expected duration. Independently detected speech in transcript
gaps triggers short-window recovery, and unresolved coverage is rejected rather
than silently passed to the cleaner. Repeated-opening checks protect complete
final takes. Transcript rendering retains the full source transcript.

## Keyboard routing

The local event monitor must preserve `nil` when a key is consumed. Falling
back to the original event let the focused control handle it again. The
persistent editor host now supplies the active command scope; an offscreen
authentication web view cannot disable the editor. Real text fields keep their
keys, and bracket characters work on layouts requiring Option or Shift.

## Imported overlay placement

“Put all the overlays we got where they make sense” previously matched the
independent substrings `make` and `overlay`, entering visual generation. A
creation verb must now act on a visual noun. Adding overlays uses imported
media when available unless a new design is explicitly requested. The exact
reported command completed within 15 seconds in the installed app, with four
imported overlays and four sound effects.

## Spoken number reveals

Requests such as “make @google ads.png reveal the numbers as I say them” have a
local path for an already placed imported image. Vision reads standalone
numeric values; the editor binds them to nearby words in the kept timeline.
It preserves the original image and replaces the existing overlay instance
with an editable scene using timed masks. The card extends to cover the final
matched cue. Repeating the request updates that instance, and Undo restores it.

The labels remain visible, each matched value fades in over 160 ms beginning
at its word, and unmatched values stay hidden. Whole-dollar speech may match a
currency amount rounded to that dollar; counts and percentages require exact
values. Spoken number phrases must parse in full, so “four” inside “thirty
four” is not treated as a separate value. Matching is limited to the nearby
passage rather than another mention later in the video.

The supported image has readable numeric fields on uniform opaque backgrounds.
Unreadable or mixed text/value fields and detailed backgrounds produce an
explanation without changing the timeline. OCR and word recognition can still
be imperfect; this does not claim arbitrary-image understanding. The source
and mask pixels are normalized to the same sRGB space. Preview and export use
the existing shared scene renderer.

The real-image QA test is opt-in using `NUMBER_REVEAL_PROJECT` (project JSON),
`NUMBER_REVEAL_OUTPUT` (a separate directory), and optionally
`NUMBER_REVEAL_EXPORT=1`. It writes before/after images and an exported excerpt
without saving over the source project. The ep12 screenshot yielded cost at
6.524 seconds and clicks at 8.249 seconds; impressions and average CPC remained
hidden. A synthetic Display P3 regression test checks that masking leaves no
visible color patch.
