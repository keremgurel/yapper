# Social sharing image

The default Open Graph and X/Twitter image is `public/og-studio.png`, a
1200 × 630 PNG. Both the root layout and `marketingMetadata` reference it.
The distinct URL lets crawlers fetch the Studio artwork without reusing the
old `/og.png` image cache. Platforms may still cache previously shared URLs.

The artwork was made with the built-in image generation tool, then resized
and compressed with Sharp. It is an illustrative product composition, not
a screenshot or customer testimonial.

## Generation brief

Create a clean Yapper Studio link-preview image that matches the homepage:
an almost-white background, black system-sans typography, quiet gray
supporting copy, generous margins, and a single front-facing video editor
below the headline. Use the exact headline “Everything you need” / “to
create content.”, the wordmark “yapper studio”, the URL “ypr.app”, and the
supporting line “Ideas. Scripts. Recording. Editing. Publishing.” The editor
combines a transcript, a creator speaking to camera, and a muted blue-gray
timeline. Keep the main headline legible at thumbnail size. Avoid the old
orange sphere, speech-practice messaging, rainbow colors, ornamental
gradients, floating badges, device frames, and watermarks.

## Updating it

Export an opaque 1200 × 630 PNG. Check the full-size image and a 320px-wide
preview, then verify the homepage's rendered `og:image` and `twitter:image`
tags. If changing the asset filename, update both metadata sources together.
