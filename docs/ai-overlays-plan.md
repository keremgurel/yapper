# AI-generated overlays

Status: implemented 2026-09-03. Owner: Kerem. Scope: the native Mac editor and the
Vercel backend it already talks to.

Implementation update: see [the integration handoff](ai-overlays-integration.md)
for the current implementation and live-model verification. The design below
records the original proposal; the integration handoff is authoritative. Editorial
examples below are not category restrictions: opinions and abstract concepts
may receive visuals when that genuinely helps or the creator requests one.

## What the creator gets

Chirpy reads the transcript, decides where a visual would help, designs it, and
puts it on the timeline. There is no proposal step. The creator asks in one of
two ways:

> When I say that we went from 1,200 to 2,850 customers, create an animation
> that visualizes the growth.

> Add overlays where they would improve the video.

The first is a brief for one moment. The second hands Chirpy the editorial
call, and the right answer is often one or two overlays, sometimes none. Every
overlay it makes lands in the media library with a name that says what it
looks like ("Customer growth counter, 1,200 to 2,850"), a still and an animated
preview, a one line description, the words it was made for, and where it sits
on the timeline. From then on it is a thing the creator can point at:

> Make @Customer growth counter more minimal.
> Move @Europe expansion map to the next sentence.
> Use @Customer growth counter again near the conclusion.

Every change is one ⌘Z.

## What already exists, and is reused as is

The editor already has most of the machinery. The feature is an extension of
the b-roll placement pass, not a second system beside it.

| Existing piece                                                          | Where                                                                        | Reused for                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ProjectOverlay` with lanes, keyframes, crop, hide, undo                | `Models/EditorProject.swift:227`                                             | A generated visual is an overlay whose media is a scene instead of a file |
| Quote anchored timing (the model returns verbatim words, never seconds) | `Models/Overlays/OverlayPlan.swift`, `src/lib/studio/overlay-plan.ts`        | Where each visual starts and ends                                         |
| Face detection and the keep-out solver                                  | `Services/FaceDetectionService.swift`, `Models/Overlays/OverlayLayout.swift` | The box each visual is designed to fit                                    |
| One-transaction commit with rollback                                    | `EditorSession+OverlayPlacement.swift:189`                                   | Undo for generation and for every revision                                |
| `@` mentions validated against real library names                       | `Models/Overlays/OverlayMention.swift`                                       | Referencing a generated overlay                                           |
| Core Animation burn-in at export                                        | `Services/CompositionBuilder.swift:843`                                      | Rendering scenes into the exported file                                   |
| Gemini image generation                                                 | `src/lib/publish/thumbnail.ts`                                               | Illustrations, maps, and imagery inside a scene                           |
| Brand kit API                                                           | `src/app/api/brand/route.ts`                                                 | Colors and logos, which the editor does not read today                    |

## The one new thing: a scene format

The question underneath "creative freedom, safe rendering" is what the model
hands back. Letting it write code (SwiftUI or HTML) gives freedom and
takes away every guarantee: rendering would differ between preview and export,
run at unknown cost, and could not be validated. A fixed template library gives
guarantees and takes away the freedom.

The middle is a small declarative scene language that the model composes from.
Building materials, in the sense the brief asks for: shapes, text, numbers,
paths, icons, images, and animations on their properties. Every chart, counter,
diagram, comparison, or typographic moment is a composition of those. The app
renders it; the model never touches a renderer.

A scene is JSON. Coordinates are fractions of the overlay's own box, so the
same scene reads correctly at any placement and any export size, the same rule
the caption and text systems already follow. Sizes are fractions of the box
height. Times are seconds from the overlay's own start, the same convention as
`OverlayKey`.

```json
{
  "version": 1,
  "duration": 4.2,
  "poster": 1.8,
  "background": { "fill": "brand.surface", "cornerRadius": 0.08 },
  "nodes": [
    {
      "id": "label",
      "type": "text",
      "text": "Customers",
      "font": "modern",
      "weight": "semibold",
      "size": 0.09,
      "color": "brand.ink",
      "x": 0.08,
      "y": 0.18,
      "width": 0.84
    },
    {
      "id": "count",
      "type": "number",
      "from": 1200,
      "to": 2850,
      "format": "grouped",
      "font": "modern",
      "weight": "bold",
      "size": 0.34,
      "color": "brand.primary",
      "x": 0.08,
      "y": 0.36,
      "width": 0.84
    },
    {
      "id": "bar",
      "type": "rect",
      "fill": "brand.primary",
      "anchor": "left",
      "x": 0.08,
      "y": 0.8,
      "width": 0.84,
      "height": 0.06,
      "cornerRadius": 0.03
    }
  ],
  "animations": [
    {
      "node": "*",
      "property": "opacity",
      "from": 0,
      "to": 1,
      "start": 0,
      "end": 0.25
    },
    {
      "node": "count",
      "property": "value",
      "from": 0,
      "to": 1,
      "start": 0.3,
      "end": 1.6,
      "easing": "outCubic"
    },
    {
      "node": "bar",
      "property": "scaleX",
      "from": 0.42,
      "to": 1,
      "start": 0.3,
      "end": 1.6,
      "easing": "outCubic"
    },
    {
      "node": "*",
      "property": "opacity",
      "from": 1,
      "to": 0,
      "start": 3.9,
      "end": 4.2
    }
  ]
}
```

Node types: `text`, `number` (animated count with a format), `rect`, `ellipse`,
`line`, `path` (SVG path data in a unit box, with draw-on), `icon` (a name from
the Lucide set, which is ISC licensed and already a dependency on the web),
`image` (a brand logo or a generated picture, by asset id), and `group`.
Animatable properties: `opacity`, `x`, `y`, `scaleX`, `scaleY`, `rotate`,
`value`, `strokeEnd`, `width`, `height`. Easings are a named handful. Colors are
hex or a brand token. Fonts are the editor's own set, so export never meets a
font it cannot load.

That list is deliberately short. A bar chart is rects with `scaleY` animations.
A line chart is a path with `strokeEnd`. A three-step flow is icons, text, and
arrow paths drawn on in sequence. A map is a generated image with paths and
labels animated over it. The model composes from these rather than picking
from a menu.

The format is versioned and forgiving: unknown fields are ignored and unknown
node types are dropped with a note in Chirpy's reply, so a newer server never
breaks an older app.

## How a request becomes overlays

Two model passes, with the layout solver between them so the designer knows
the real space it has.

1. The direct pass is one call. It reads the kept words in playback order (the
   existing `placeableWords`), the frame shape, the speaker track, what is
   already on the timeline (overlays, on-screen text, and where the caption
   band sits), a digest of the brand kit, and the instruction. It returns a
   list of moments. Each moment has a verbatim quote and an optional cue word,
   the same anchoring the current pass uses because counting seconds is what
   a language model is bad at, plus a visual brief in plain words, a proposed
   name, and a description.
2. The app solves a box for each moment. It maps the quote to timeline
   seconds, then runs the keep-out solver over that span. The solver already
   avoids the face; it grows to also avoid the caption band, overlays that are
   on screen at the same time, and the platform safe zones for the project's
   aspect. The box's aspect and its rendered pixel size go to the designer.
3. The design pass is one batched call for all moments. For each it gets the
   brief, the box (aspect, and the height in pixels at export), the brand
   tokens, the scene language reference with a few worked examples of the
   language rather than of outcomes, and the readability rules. It returns a
   scene per moment, plus any image generation requests.
4. The app validates each scene (below), renders a poster frame and an
   animated preview, writes the asset into the project package, and creates a
   `ProjectOverlay` pointing at it.
5. Everything from one request lands through `commitPreparedTimelineEdit` as a
   single undo step, and Chirpy's reply lists one line per overlay, exactly as
   the placement pass reports today.

That is two requests per take rather than one per overlay. It keeps the client
inside the per-request provider budget and gives a natural moment to show
"Found 3 moments, designing" between them.

## Editorial judgment

The direct pass carries the editorial rules, and they are written as
constraints on when to add, because over-placement is the failure mode that
makes videos worse.

A moment qualifies when a visual does work speech cannot: a number or a change
in a number, a comparison, a sequence or process, a list being enumerated, a
named place or thing the viewer may not picture, or a claim that reads better
with the words on screen. Abstract talk and transitions between points do not
qualify. When the instruction is broad, the pass is told that returning one
moment or none is a good answer, that two visuals should not sit within a few
seconds of each other, and that a visual over the wrong sentence is worse than
no visual. The reply says how many moments it considered and why it passed on
the rest, in a sentence, so the creator learns what Chirpy is looking for.

When the instruction names a moment, the pass finds that quote and designs for
it, and adds nothing else.

Selectivity gets an eval set the way 1-Click Edit did: a dozen transcripts with
the moments a human editor would pick, scored on precision first. The harness
in `scripts/clean-eval` is the model for it.

## Constraints the system enforces, not the model

| Constraint                     | Enforced by                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand kit                      | Server fetches colors and logos and passes them as tokens (`brand.primary`, `brand.ink`, `brand.logo`). The renderer resolves tokens. A project with no kit gets a neutral house palette, or one sampled from the footage.                                                                           |
| Video dimensions, aspect ratio | Boxes and scenes are in fractions; the solver runs for the project's aspect; the designer is told the aspect and pixel height of its box.                                                                                                                                                            |
| Caption placement              | The caption band, computed from `captionStyle` and font scale, becomes a keep-out region in the solver.                                                                                                                                                                                              |
| Safe areas                     | Per-aspect platform safe zones (the right column and bottom band of a 9:16 frame) become weighted keep-out regions.                                                                                                                                                                                  |
| Speaker position               | Existing face detection and speaker regions, unchanged.                                                                                                                                                                                                                                              |
| Existing overlays and density  | Concurrent overlays are keep-out regions; the direct pass sees what is already placed; at most one generated overlay on screen at a time.                                                                                                                                                            |
| Readability                    | The validator computes each text node's height at export size and rejects anything under a minimum fraction of frame height; reading time (words per second plus a settle) sets a floor on duration, and the app extends the overlay to the end of its sentence when the quote is shorter than that. |

None of these are in the designer's prompt as requests. They are checks the
scene has to pass and inputs the scene is shaped by.

## Rendering scenes safely

One renderer. A scene is turned into a Core Animation layer tree, and that
tree is used everywhere: at export it is added to the existing animation tool
path beside image overlays and text; in the preview it lives in a layer-hosting
view over the player, with the tree's clock driven by player time
(`speed = 0`, `timeOffset = t`), so scrubbing shows the right frame; and the
poster and animated preview for the library are rendered offscreen from the
same tree. The current system keeps a SwiftUI canvas and a Core Animation
burn-in in step by hand with pixel tests. Scenes skip that because they are
drawn in one place, and they get the same kind of pixel test to prove preview
and export match.

Validation runs before anything is rendered, on the server and again in the
app:

| Limit                                                             | Why                                              |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| At most 64 nodes and 96 animations per scene                      | Bounded layer count, bounded export time         |
| Text at most 120 characters per node, paths at most 4 KB          | No runaway payloads                              |
| Image refs only from the project's own asset ids                  | Nothing external, nothing fetched at render time |
| Fonts from the editor's enum, colors hex or token                 | Export can always draw it                        |
| Every fraction clamped to its range, every time inside `duration` | A broken value degrades, never crashes           |
| Minimum text height and reading time (above)                      | Legible at playback speed                        |

A scene that fails validation is repaired where the fix is mechanical
(clamping, dropping an unknown node) and otherwise dropped, with a line in the
reply. The creator never sees a half-rendered card.

Generated pictures (maps and illustrations) come from the image
model already wired for thumbnails, requested by the designer as a node with a
prompt, generated server side, and stored in the package as a normal image
asset that the scene references by id. The scene layer animates over it.
Video generation stays out of the first version; it is slow and expensive, and
animated scenes cover most of what it would be used for.

## The media library entry

A generated overlay is a `ProjectMedia` with a new kind, `scene`, whose URL
points inside the `.yapperproj` package. Source media is never copied into a
package, but a generated asset is the project's own work and belongs there.
The overlay pipeline (lanes, keyframes, hide, behind-speaker, `@` mentions,
usage on the track rail) works on it without changes because `ProjectOverlay`
only knows a media id.

Alongside the existing fields, the asset carries a generation record: the
quote and its source range (so the moment survives cuts, the way captions do),
the brief, the description, the brand kit version it was designed against, the
model used, and a version list. Each scene version is an immutable file
(`generated/<id>/v3.scene.json`) with its own poster and preview. Because undo
is a snapshot of the whole document and files are never overwritten, undoing a
regeneration restores the previous scene for free.

Names come from the direct pass and are checked, not trusted. Between eight
and sixty characters, must contain a concrete noun or number from the brief,
must not match a generic list ("Overlay 1", "Animation", "Graphic"), and must
be unique in the library; a collision gets the quote's first words appended.
Descriptions are one sentence about what it looks like, not what it means:
"Two orange bars rising left to right with the years underneath."

The library row shows the name, the poster, the description, the quote, and the
timeline usage. Hovering plays the animated preview.

## Revisions by @-mention

Today a mention forces the placement intent. A mention that resolves to a
generated asset routes to a new revise intent instead. As with sound levels,
the deterministic cases are handled locally with no model call; the rest are
one call.

| Request                                                                                  | Handling                                                                                                                                                      | Instances touched                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| "more minimal", "remove the logo", "icons instead of text", "change the number to 3,000" | Designer call with the current scene, the original brief, and the instruction; returns a new version, updated name and description if what it depicts changed | All, since instances share the asset                 |
| "move to the next sentence", "put it where I mention Berlin"                             | Direct-lite call that resolves the new quote; box re-solved                                                                                                   | The one referenced (nearest the playhead if several) |
| "stay on screen longer", "come in earlier"                                               | Local: extend to the end of the sentence or by a fixed step; box re-solved; scene `duration` stretched by holding the poster frame                            | The one referenced                                   |
| "delete", "remove"                                                                       | Local: remove overlays; the asset stays in the library unless the creator says "from the library"                                                             | All                                                  |
| "use again near the conclusion"                                                          | Direct-lite finds a matching quote in the closing stretch; new overlay, same asset                                                                            | New instance                                         |

Every path ends in `commitPreparedTimelineEdit`, so a revision is one ⌘Z, and
Chirpy's reply names what changed and on which instances.

## Server side

Three routes beside `/api/place-overlays`, sharing one handler and the same
guards, bounded JSON, provider timeout, and credit reservation:

| Route                  | Model                                                      | Credits                                                                      |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/api/direct-overlays` | `AI_DIRECT_MODEL`, default `claude-opus-4.7`               | 1 per call                                                                   |
| `/api/design-overlays` | `claude-opus-4.7`, one request per moment                  | 2 per scene that validates, plus 2 per picture; refunded when a design fails |
| `/api/revise-overlay`  | Same designer for a restyle; `AI_PLACE_MODEL` for a retime | 2 for a restyle, 1 for a retime                                              |

`AI_OVERLAY_MODEL` overrides every pass. The direct pass runs on a reasoning
model because the earlier small model chose decorative ideas; its reply is
reviewed by an internal editorial check before it is returned. The brand kit is
fetched server side from the existing brand tables and sent to the designer as
tokens; the primary logo comes to the app as a URL it downloads into the
package. Input validation mirrors `overlay-input.ts`: every string interpolated
into a prompt is bounded and typed.

## Build order

| Phase | Work                                                                                                                                                                                                           | Size    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | Scene format, validator, Core Animation renderer, preview host, export burn-in, poster rendering, pixel tests. A debug panel that renders a pasted scene.                                                      | 2 weeks |
| 1     | Direct and design routes, prompts with worked examples, brand fetch, solver extended with caption band and safe zones, library entries and naming, Chirpy routing for the two request shapes, one-undo commit. | 2 weeks |
| 2     | Revise intent: local commands, revise route, instance rules, name updates on regeneration.                                                                                                                     | 1 week  |
| 3     | Generated images as scene nodes, brand logos in the package.                                                                                                                                                   | 1 week  |
| 4     | Selectivity eval set, animated library previews, progress between the two passes, per-platform safe zone presets.                                                                                              | ongoing |

Phase 0 is the foundation and has no AI in it. It is worth shipping on its own
as a hand-authored motion card feature, and it is what makes every later phase
a prompt change rather than a renderer change.

## Decisions taken, with the alternative named

Scene JSON over model-written code: freedom in composition, guarantees in
rendering. Revisit only if the format proves too small for what creators ask
for, and then grow the format rather than open a code path.

Restyling a shared asset changes every instance. That is what "make @X more
minimal" means when X is on the timeline twice, and the reply says so. Timing
changes are per instance.

Design happens after the box is solved. The alternative, designing first and
fitting later, produces cards with text that no longer fits.

Two requests per take instead of one. One request would mean the server solving
layout without the app's dense face samples, or the app sending them all up.

## Risks

Chart and diagram quality from a structured-output model is the unknown.
Mitigation is worked examples of the language in the designer prompt, a small
gallery of scenes to score against, and the debug panel so we can iterate on
prompts without touching Swift.

Over-placement on broad requests. Mitigation is the eval set and the density
rules, measured on precision before anything else.

Preview scrubbing of Core Animation trees is a known technique with known
edge cases (implicit animations, layer time when the player rate changes). The
pixel tests catch drift; a hold-frame fallback covers a tree that will not
scrub.
