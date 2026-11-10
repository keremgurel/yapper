---
name: overlay-backdrop
description: Put a calm backdrop behind a cutaway card in a talking-head video, outside the Yapper app. Use when an overlay (a screenshot, a product UI card, a Remotion overlay render) needs the speaker's room pushed back behind it, either frosted (the speaker's own footage blurred and dimmed) or a dark generated preset (navyGlow, aurora, lightRays, grainient, shapeGrid). Triggers include "frosted background behind the overlay", "blur the background during the cutaway", "navy glow backdrop", "put a backdrop behind this card".
---

# Overlay backdrop

Yapper's editor has this built in (Overlays tab, Backdrop row). This skill does the same thing with ffmpeg and a small Swift script, for footage that is not in a Yapper project. The numbers match the app, so a video cut either way looks the same.

## What the looks are

Frosted is the speaker's own frame scaled 1.5x about the centre, blurred with a sigma of 2.5% of the frame width, then brightness -0.07 and saturation 0.9. It eases in over 0.35 s when the card appears.

The presets are drawn in code, so they need no image files. All of them are dark and still, and all of them darken the band 75 to 85% down the frame, where white captions with a black outline sit.

| Preset | Look |
| --- | --- |
| `navyGlow` | Deep navy, a tall soft glow and a brand-blue halo behind the card, fine grain |
| `aurora` | Faint teal and violet bands across the top of a near-black sky |
| `lightRays` | Soft rays from just above the frame, fading by a third of the way down |
| `grainient` | Dark mesh of plum, ember and navy with heavier grain |
| `shapeGrid` | Faint grid that only shows around the card |

Keep them calm. Kerem has rejected backdrops that drift, glow hard or pull the eye off the card. Do not use Runway or any video-to-video model for this: it repaints the room differently on every clip.

## Apply one

```bash
skills/overlay-backdrop/scripts/backdrop.sh \
  --speaker talk.mp4 --start 6.5 --end 27.1 --look frosted \
  --card overlay.mov --out talk-with-cutaway.mp4
```

`--card` is a full-frame overlay with alpha, which is what the Remotion overlays render (ProRes 4444 `.mov`) and what a full-frame PNG with transparency gives you. Leave it out to lay in only the backdrop. For a preset, `--focus 0.5,0.4` moves the glow to the card's centre, in fractions of the frame. Audio is copied from the speaker file.

To get a preset as a still plate at any size:

```bash
swift skills/overlay-backdrop/scripts/render-preset.swift navyGlow 1080 1920 plate.png 0.5 0.42
```

## Check the result

Pull a frame from inside the cutaway and one from just before it, and look at both:

```bash
ffmpeg -ss 10 -i talk-with-cutaway.mp4 -frames:v 1 inside.png
ffmpeg -ss 6 -i talk-with-cutaway.mp4 -frames:v 1 before.png
```

The caption band should still be dark, the card should sit fully on top, and the frame before the cutaway should be untouched.

## Keeping it in step with the app

`scripts/render-preset.swift` is generated from the app's own preset code. After changing a preset in `native-macos/Sources/YapperNative/Services/Backdrop/`, run `skills/overlay-backdrop/scripts/sync-presets.sh` and commit the result. If a frosted number changes in `FrostedBackdrop.swift`, change it in `backdrop.sh` too.

The person matte that swaps the speaker's whole background (rather than putting something behind one card) lives in Yapper as Video tab, Remove background, and in `tef-practice` at `marketing/organic/video/tools/bgswap/`. Use one fixed plate for every clip of a video.
