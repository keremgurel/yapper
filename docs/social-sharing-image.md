# Social sharing image

The default Open Graph and X/Twitter image is `public/og-studio.png`, a
1200 × 630 PNG. Both the root layout and `marketingMetadata` reference it.
The distinct URL lets crawlers fetch the Studio artwork without reusing the
old `/og.png` image cache. Platforms may still cache previously shared URLs.

The artwork was made with the built-in image generation tool, then resized
and compressed with Sharp. It illustrates the five stages of the creator
workflow in colored tiles.

## Generation brief

Create a clean Yapper Studio link-preview image that matches the homepage:
an almost-white background, black system-sans typography, generous margins,
the wordmark “yapper studio”, and the URL “ypr.app”. Use the exact three-line
headline “Everything you need” / “to create content” / “at 10x speed.” Below
it, arrange five equally sized rounded tiles with matching label baselines:
“Brainstorm” on lilac with an idea bulb and conversation bubbles, “Script”
on sky blue with a script sheet, “Record” on apricot with a camera, “Edit”
on sage with scissors and a timeline, and “Crosspost” on butter yellow with
an outgoing arrow connected to YouTube, Instagram and TikTok. Use coherent,
restrained tactile illustrations. Keep the headline and labels legible at
thumbnail size. Avoid extra copy, the old orange sphere, speech-practice
messaging, saturated rainbow backgrounds, ornamental glows, floating badges,
device frames, and watermarks.

## Updating it

Export an opaque 1200 × 630 PNG. Check the full-size image and a 320px-wide
preview, then verify the homepage's rendered `og:image` and `twitter:image`
tags. If changing the asset filename, update both metadata sources together.
