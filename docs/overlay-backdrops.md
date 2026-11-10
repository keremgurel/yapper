# Overlay backdrops

What sits behind a cutaway card while it is on screen. Written November 9, 2026.

## Why

A product card laid straight over a talking head reads as pasted on. In the TEF ads the fix was done by hand: the speaker's own footage blurred and darkened behind the card (ffmpeg `scale=1840:-1,gblur=sigma=46,crop,eq=brightness=-0.07:saturation=0.9`, eased in over 0.35 s), or a navy frame with a soft glow behind the card. This makes both a click in the editor.

## Where it lives in the app

The Overlays tab, in the selected overlay's inspector, as one row called Backdrop between Depth and Crop. It is a row of small portrait swatches showing what each choice looks like: none, frosted (drawn from a real frame of the speaker), then the presets. One line under the row says what is picked.

There is no extra step when an overlay is added. Whatever was picked last becomes the backdrop for the next overlay added, in any project, so a video's look is set once. Until something is picked, new overlays get none, so nobody's edit changes without them asking.

Swapping the speaker's whole background was already in the app as Video tab, Background, Room: Remove, which uses the Vision person matte. Its Behind row now takes the same presets as well as a flat colour, so a swap and a cutaway backdrop can match.

## Choices

| Choice | What it is | State |
| --- | --- | --- |
| Frosted | The speaker's frame scaled 1.5x, blurred at 2.5% of the frame width, brightness -0.07, saturation 0.9 | Built |
| Navy glow | Deep navy, a tall soft glow and a brand-blue halo centred on the card, from `glow-backdrop.tsx` | Built |
| Aurora | Faint teal and violet bands across the top | Built |
| Light rays | Soft rays from above the frame | Built |
| Grainient | Dark plum, ember and navy mesh with heavier grain | Built |
| Grid | A faint grid that only shows around the card | Built |
| Your image | A picture from Media, aspect-filled | Designed, not built |
| From a prompt | An image generated from a sentence, then used like your image | Designed, not built |

Every preset is dark and still, has fine grain against banding, and darkens the band 75 to 85% down the frame where white outlined captions sit. A test checks that band on every preset.

Your image and From a prompt would both end as a picture in Media, so they need one more model case (`kind: image` with a media ID) and one more compositor fill. The prompt version needs an image generation endpoint on the server; there is none in the native app today, which is why neither shipped here.

## Data

`ProjectOverlay.backdrop: OverlayBackdrop?`, where `OverlayBackdrop` is `{ kind: frosted | preset, preset? }`. `nil` draws nothing, which is every overlay saved before this. `EditorProject.backdropPreset: BackdropPreset?` sits next to the existing `backdrop` colour for the background swap.

Both go through app actions, so Chirpy can set them too: `editor.overlays.setProperties` takes `backdrop` (`none`, `frosted` or a preset name) and `editor.project.setBackdrop` takes `preset` as well as `color`.

## Render path

Preview and export share one path, the editor's own compositor (`StudioVideoCompositor`). A project with any backdrop needs it, so `needsStudioCompositor` turns on.

The composition builder turns each overlay with a backdrop into a span (start, end, lane). Each span start, fade end and span end becomes an instruction boundary. Inside a span, one extra layer goes between the speaker and the cards: for frosted, the speaker's own track, placed exactly as the speaker is and then frosted; for a preset, a still painted once at the render size. Where two spans overlap, the higher lane wins. The layer fades in with a smoothstep over 0.35 s.

Presets are pixel functions written in Swift (`BackdropPresetShaders.swift`) and painted on the CPU across all cores, a few tens of milliseconds for a 1080 by 1920 frame, then cached by preset, size and card centre. Nothing is stored on disk.

Cards drawn by Core Animation in the export and by SwiftUI in the preview sit above the composition anyway, so they land on top of the backdrop without changes.

## Outside the app

`skills/overlay-backdrop/` does the same with ffmpeg and a Swift script generated from the app's preset code, for footage that is not in a Yapper project.
