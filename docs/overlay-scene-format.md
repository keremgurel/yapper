# Overlay scene format

The declarative language Chirpy designs generated overlays in. The server
validates it after the model writes it, the app validates it again before
drawing it, and one Core Animation renderer draws it for preview, export and
library posters. Both validators are hand-mirrored from this document:
`src/lib/studio/scene/` on the web and `native-macos/.../Models/Scene/` in the
app. Change this file first, then both.

## Units

Every coordinate is a fraction of the overlay's own box, not of the video
frame. `x` and `width` are fractions of the box width, `y` and `height` are
fractions of the box height, measured from the top left. Sizes that are not
one of those four (font size, stroke width, corner radius, line width) are
fractions of the box height, so a scene designed for a wide box still reads at
the same weight in a tall one. Times are seconds from the overlay's own start.

Colors are `#RRGGBB`, `#RRGGBBAA`, or a brand token: `brand.primary`,
`brand.secondary`, `brand.accent`, `brand.ink`, `brand.surface`, `brand.muted`.
Tokens resolve against the palette stored with the asset, so a scene renders
the same way after the brand kit changes.

## Scene

```json
{
  "version": 1,
  "duration": 4.2,
  "poster": 1.8,
  "background": { "fill": "brand.surface", "cornerRadius": 0.08, "opacity": 1 },
  "nodes": [],
  "animations": []
}
```

`duration` is seconds, and the overlay on the timeline decides the real length:
a longer overlay holds the last frame, a shorter one is cut. `poster` is the
time of the most informative frame, used for the library still; it defaults to
60% of the duration. `background` is optional; a scene without one is drawn
straight over the video.

## Nodes

Common fields: `id` (unique in the scene), `type`, `x`, `y`, `width`,
`height`, `opacity` (default 1), `rotate` (degrees, default 0), `anchor`
(where scale and rotate pivot: `center`, `left`, `right`, `top`, `bottom`,
`topLeft`, `topRight`, `bottomLeft`, `bottomRight`; default `center`).

| type      | fields                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`    | `text`, `font` (`modern`, `rounded`, `editorial`), `weight` (`regular`, `medium`, `semibold`, `bold`, `black`), `size`, `color`, `align` (`left`, `center`, `right`), `lineHeight` (multiple, default 1.15), `uppercase` |
| `number`  | Everything `text` takes except `text`, plus `from`, `to`, `format` (`plain`, `grouped`, `percent`, `compact`, `decimal1`), `prefix`, `suffix`. Draws the value at `value` progress between `from` and `to`.              |
| `rect`    | `fill`, `stroke`, `strokeWidth`, `cornerRadius`                                                                                                                                                                          |
| `ellipse` | `fill`, `stroke`, `strokeWidth`                                                                                                                                                                                          |
| `line`    | `x2`, `y2` (end point, same units as `x`, `y`), `stroke`, `strokeWidth`, `dashed`                                                                                                                                        |
| `path`    | `d` (SVG path data in a unit square mapped onto the node box), `fill`, `stroke`, `strokeWidth`                                                                                                                           |
| `icon`    | `icon` (a Lucide icon name), `color`, `strokeWidth` (default 0.02)                                                                                                                                                       |
| `image`   | `asset` (`brand.logo`, or `image:<key>` for a picture the designer asked for), `fit` (`contain`, `cover`), `cornerRadius`                                                                                                |
| `group`   | `children` (nodes positioned inside the group's box)                                                                                                                                                                     |

Text sizes and stroke widths are fractions of the box height. A `number` node
formats with `en-US` grouping.

Generated text/number nodes should provide explicit height and enough width
for their longest content. Small fonts are flagged, never enlarged in place.
Design delivery includes a sampled readability/collision preflight with bounded
model repair; the app then checks actual native font metrics before insertion.
Use sequential reveals or simpler wording when the allocated space is tight.
The requested duration is sent to the designer to millisecond precision so
transcript-derived spans do not fail validation because of prompt rounding.

## Animations

```json
{
  "node": "count",
  "property": "value",
  "from": 0,
  "to": 1,
  "start": 0.3,
  "end": 1.6,
  "easing": "outCubic"
}
```

`node` is a node id, or `*` for every top level node. `property` is one of
`opacity`, `x`, `y`, `scaleX`, `scaleY`, `scale`, `rotate`, `value`,
`strokeEnd`, `width`, `height`. `from` defaults to the node's own value.
`easing` is one of `linear`, `inQuad`, `outQuad`, `inOutQuad`, `outCubic`,
`inOutCubic`, `outExpo`, `outBack`; default `outCubic`. `stagger` (seconds)
offsets the animation for each successive child when `node` is a group or `*`.

Before `start` the property holds `from`; after `end` it holds `to`. Several
animations on the same property of the same node run in `start` order and
each takes over from the previous one's `to`.

## Limits

The validators enforce these. A value outside its range is clamped where that
is harmless and the node is dropped where it is not; the scene is rejected
only when nothing usable is left.

| Limit                                 | Value                                                       |
| ------------------------------------- | ----------------------------------------------------------- |
| Nodes, counting children              | 64                                                          |
| Animations, counting staggered copies | 96                                                          |
| Text per node                         | 120 characters                                              |
| Path data per node                    | 4 KB                                                        |
| Duration                              | 0.5 to 30 seconds                                           |
| Fractions                             | -0.5 to 1.5 (position), 0 to 1.5 (size)                     |
| Smallest legible text                 | `size` × box height ≥ 2.2% of the frame height at placement |
| Images per scene                      | 2                                                           |
| Image reference                       | `brand.logo` or an `image:<key>` the design reply delivered |

Unknown fields are ignored. Unknown node types and unknown properties are
dropped with a note. A `version` above what the app knows is rejected.

## Wire formats

### `POST /api/direct-overlays`

Request:

```json
{
  "instruction": "Add overlays where they would improve the video.",
  "words": [{ "text": "we" }, { "text": "went" }],
  "frameAspect": 0.5625,
  "speaker": [{ "at": 1.0, "x": 0.3, "y": 0.2, "width": 0.4, "height": 0.3 }],
  "placed": [
    {
      "name": "Customer growth counter",
      "at": 12.1,
      "duration": 4.2,
      "kind": "scene"
    }
  ],
  "texts": [{ "text": "44%", "at": 30.2 }],
  "captionBand": { "y": 0.78, "height": 0.1 }
}
```

Reply:

```json
{
  "moments": [
    {
      "quote": "we went from twelve hundred to twenty eight fifty customers",
      "cue": "twelve",
      "brief": "An animated counter climbing from 1,200 to 2,850 with a bar that grows underneath",
      "name": "Customer growth counter, 1,200 to 2,850",
      "description": "A large orange number counting up over a short bar that lengthens with it.",
      "kind": "counter",
      "wantsImage": false
    }
  ],
  "considered": 5,
  "passedOn": "The rest of the take is opinion and transitions, where a visual would only compete with you."
}
```

`kind` is one of `counter`, `chart`, `comparison`, `list`, `diagram`,
`typography`, `map`, `illustration`, `other`.

### `POST /api/design-overlays`

Request: the moments the app kept, each with the box the solver gave it.

```json
{
  "instruction": "…the creator's original sentence…",
  "frameAspect": 0.5625,
  "frameHeightPx": 1920,
  "moments": [
    {
      "id": "m1",
      "brief": "…",
      "name": "…",
      "description": "…",
      "kind": "counter",
      "wantsImage": false,
      "quote": "…",
      "sentence": "…the whole sentence the quote sits in…",
      "box": { "aspect": 1.78, "widthPx": 1080, "heightPx": 607 },
      "duration": 4.2
    }
  ]
}
```

Reply:

```json
{
  "brand": {
    "palette": {
      "primary": "#F96F4B",
      "secondary": "#1B181C",
      "accent": "#F96F4B",
      "ink": "#1B181C",
      "surface": "#FFFFFF",
      "muted": "#8A858B"
    },
    "logos": [
      { "key": "brand.logo", "url": "https://…", "mimeType": "image/png" }
    ]
  },
  "scenes": [
    {
      "id": "m1",
      "name": "…",
      "description": "…",
      "scene": { "version": 1, "…": "…" },
      "images": [
        { "key": "hero", "mimeType": "image/png", "data": "…base64…" }
      ],
      "notes": ["Dropped an unknown node type 'sparkline'."]
    }
  ],
  "failed": [{ "id": "m2", "reason": "invalid_scene" }],
  "balance": 41
}
```

The route reserves credits for every moment and refunds the ones in `failed`.

### `POST /api/revise-overlay`

Request:

```json
{
  "op": "restyle",
  "instruction": "Make it more minimal.",
  "asset": {
    "name": "…",
    "description": "…",
    "brief": "…",
    "quote": "…",
    "scene": { "…": "…" }
  },
  "box": { "aspect": 1.78, "widthPx": 1080, "heightPx": 607 },
  "frameAspect": 0.5625,
  "frameHeightPx": 1920,
  "duration": 4.2
}
```

Reply: one entry in the same shape as a design reply's `scenes[]`, plus
`brand` (including `palette` and `logos`) and `model`. Retiming uses
`op: "retime"` with transcript `words`, `instruction` and `quoteHint`; it returns
a transcript quote/cue rather than a redesigned scene.
