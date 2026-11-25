# Style library

A library of editorial looks for talking-head video, in two layers. Building blocks are single styles: a caption look, a split screen, a card, a cover. Templates arrange blocks into a whole video look, for example a camera-below split with a clip on top and captions on the seam. Every part of a template can be changed or swapped, by hand, by Chirpy, or by Claude or ChatGPT through a connector, and all three go through the same edit path. Started November 22, 2026 from the Ep. 15 edit.

The code is in `src/lib/style-library/`. The renderer that turns blocks and templates into pictures is in `style-runner/`.

## Building blocks

One folder under `entries/`, ending in a definition made with `defineStyle`:

| Field                | What it holds                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `version`      | `<category>.<name>`, for example `splits.half-and-half`. Templates, variants and actions point at the id. Raise the version when an option changes meaning |
| `category`, `weight` | The gallery shelf, and whether the look is `native` (could have been made in Instagram or TikTok) or `produced` (the heavier, edited look)                 |
| `output`, `layer`    | A video or a still. `frame` draws the whole picture, the take included; `overlay` is transparent and sits over the take                                    |
| `options`            | The taste. Typed specs (number, enum, colour, boolean, text, media) with a default, a range and an optional `showWhen`. This is what a variant saves       |
| `content`            | What the block shows: a picture, a title. The take and the transcript are never stored in a block. The project hands them over when it is drawn            |
| `slots`              | Open areas another block fills, with the shelves each accepts. The top of a split is a slot                                                                |
| `captionY`           | For a layout: where captions belong while it is on screen                                                                                                  |
| `rules`              | The decisions behind the defaults, each with the correction or measurement it came from                                                                    |
| `preview`            | Sample options, content and slot blocks, and the moment used for the still                                                                                 |
| `Component`          | A React component that draws the block from `options`, `content`, its filled `slots` and its `placement` (on the frame, or inside a slot)                  |

The blocks today:

| Id                     | What it is                                                                                      | Where its defaults come from                   |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `captions.plain-white` | Two or three heavy white words at a time                                                        | Ep. 15                                         |
| `layouts.full-frame`   | The take on the whole frame, optional punch-in                                                  | Not measured                                   |
| `splits.speaker-below` | The speaker as a card at the bottom, aspect kept, a visual above                                | Ep. 15                                         |
| `splits.half-and-half` | The camera fills the bottom half, cropped to fit, and the top half is one open area             | Kerem's description. No reference measured yet |
| `cards.smoked-glass`   | A dark glass card with a number on it                                                           | Ep. 15                                         |
| `overlays.media`       | A screenshot, picture or clip. Fills a slot, covers the frame, or floats whole over the speaker | Ep. 15 for the floating case                   |
| `covers.series`        | The cover every episode of a series shares                                                      | Ep. 15, measured off Ep. 9                     |

Both splits share one set of backdrop options (`shared/backdrop/`): blurred take, dotted grid, flat colour, your image, your video. "Change the background" is the same edit whichever split is on screen.

Lengths are pixels on a 1080 x 1920 frame. `DesignFrame` scales that frame to the real output, so the measured values from a reference stay in the code as they were measured. Colours accept a hex value or a brand token (`brand.primary`), resolved with the palette code the overlay scenes use (`src/lib/studio/scene/scene-colors.ts`).

## Templates

A template (`templates/template.ts`) is plain JSON: an ordered list of layers, each holding one block, and blocks hold more blocks in their slots.

```json
{
  "id": "half-and-half",
  "layers": [
    {
      "id": "layout",
      "accepts": ["layouts", "splits"],
      "block": {
        "styleId": "splits.half-and-half",
        "slots": {
          "top": {
            "styleId": "overlays.media",
            "content": { "src": "clip.mp4" }
          }
        }
      }
    },
    {
      "id": "overlay",
      "accepts": ["cards", "overlays", "hooks"],
      "block": null
    },
    {
      "id": "captions",
      "accepts": ["captions"],
      "block": { "styleId": "captions.plain-white" }
    }
  ]
}
```

Three ship in `templates/registry.ts`: `talking-head`, `half-and-half` and `speaker-below`. A template is only a starting arrangement. Each layer and each slot is a place with a dotted path (`layout`, `layout.top`, `captions`), and `listPlaces` returns them all.

Captions follow the layout. A split says where its seam is through `captionY`, and the captions in the same template sit there unless someone set their height.

`TemplateView` draws a template on a project's take and words. `StyleBlockView` draws one block and the blocks in its slots, and it is the only place a block becomes pixels.

## Editing

`editTemplate(template, edit)` in `templates/edit-template.ts` takes one of four edits and returns a new template:

| Edit         | What it does                                             | Example                                                                    |
| ------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `setOptions` | Changes the look of the block at a place                 | `at: "layout"`, `options: { backdrop: "color", backdropColor: "#1E3A8A" }` |
| `setContent` | Changes what the block shows                             | `at: "layout.top"`, `content: { src: "screenshot.png" }`                   |
| `setBlock`   | Swaps the block for another style from an accepted shelf | `at: "layout.top"`, `styleId: "cards.smoked-glass"`                        |
| `clear`      | Empties the place                                        | `at: "overlay"`                                                            |

Swapping a layout keeps what was in its slots when the new layout accepts it, so going from `splits.half-and-half` to `splits.speaker-below` carries the top visual across.

Values are checked the way the scene validator checks them: numbers are clamped, unknown keys are dropped, and each change comes back as a note. A refused edit says why and lists what would have worked: the places that exist, or the styles that place takes. That list is what lets a model correct itself in one more call.

`describeTemplate` returns each place with the block in it, the styles that could go there, and every setting with its value and limits. Controls hidden by `showWhen` are left out, as they would be in an inspector.

`templates/template-tools.ts` runs the same edits on a template held in memory, with no account or storage. The runner and tests use it.

## Saved looks: by hand, Chirpy and a connector

A look is a template a creator saved, with their own changes. It lives in `style_looks` (migration `0043`) as the template's layers, and three callers reach it through one set of operations in `operations/`:

| Caller          | How it gets in                                                                                              | Where                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| By hand         | `GET /api/styles`, `POST /api/styles/looks`, `PATCH` and `DELETE /api/styles/looks/[id]`                    | `src/app/api/styles/`                      |
| Chirpy          | `studio.styles.save`, `studio.styles.edit`, `studio.styles.delete` in `protocol/actions/studio-styles.json` | `src/lib/chirpy/studio/styles/`            |
| Claude, ChatGPT | Model Context Protocol at `POST /api/mcp`                                                                   | `src/lib/mcp/`, `src/app/api/mcp/route.ts` |

The route body, the Chirpy plan and the connector call are all checked against the same definitions in the action contract, then go to `saveLook`, `editLook` or `deleteLook`, which end in `editTemplate`. Edits apply in order and all or nothing.

The connector has no tool list of its own. `src/lib/mcp/offered-actions.ts` is a filter over the contract, and each offered action becomes a tool with the contract's description and schema, run by the executor a Chirpy turn uses. Today the filter offers `studio.styles.save` and `studio.styles.edit`. Actions that spend credits, post to a platform, set a standing rule or ask the creator to confirm in the app are left out until someone decides how a connector should handle each. Offering the Ideas or Brain actions later is a change to that filter.

Chirpy does not look things up with tools. The server reads the account and puts it in the prompt (`styles/reads.ts`, only when the request is about looks). A connector's model has no such prompt, so the same reader is offered as the read-only tool `studio_styles_context`, with `studio_styles_describe_look` for one look in full.

The connector is off unless `YAPPER_MCP=1`. It accepts a Clerk OAuth access token or the app's session, answers 401 with a pointer to `/.well-known/oauth-protected-resource`, and that route names Clerk as the authorization server. `src/lib/mcp/mcp.test.ts` runs a whole session (handshake, tools, save, edit, refusals, a second account) against PGlite with the real migrations.

A saved variant of one block (`format/style-variant.ts`) is the base id, the base version and only the options that differ. Nothing stores block variants yet. Looks cover the whole arrangement.

## The gallery

`/studio/styles` (`src/components/styles/`) is where a person does this by hand. A list of templates, saved looks and blocks sits beside a live preview and an inspector. Opening an item plays it. The inspector lists the item's parts, and for the selected part shows which block is in it, what it shows and every option as a control. Each control calls `editTemplate` in the browser, the same function the server runs, so the preview shows what a save will store. Saving a template makes a look; saving a look sends the edits made since it was opened.

The preview does not use Remotion. `stage/style-stage.tsx` hands blocks a clock that advances on animation frames and plain `<video>` and `<img>` elements, which is all a block asks of its host. The same stage would run inside a web view in the Mac or iPhone app.

Where a block has no content yet, the preview shows the block's sample content and the field shows it as a hint, so an empty card or picture never looks broken.

The page has no sidebar entry yet. It is reached by its address.

## Blocks do not import a render engine

A component gets time and media from `runtime/style-runtime.tsx`: `useStyleClock()` for the current second, frame rate and size, and `useStyleMedia()` for a `Video` and an `Image` element. Easing and entrances are plain functions in `runtime/`.

Remotion supplies those through one adapter (`style-runner/src/remotion-media.tsx` and `use-remotion-runtime.ts`). Moving to Hyperframes, or to a renderer of our own, means writing that adapter again and leaves every block alone.

## Running it

```bash
cd style-runner && npm install
```

```bash
npm run studio
```

```bash
npm run previews
```

`studio` opens Remotion Studio with one composition per template and per block (also the `style-studio` entry in `.claude/launch.json`). A block shows its options as live controls. A template shows its JSON, which can be edited in place. Studio shows a "cannot update default props" notice when a control changes, because it tries to write the value back into `Root.tsx`. The preview still updates and nothing is written.

`previews` renders a still of every template and block into `public/style-previews/` for the gallery list. To render an edited template, pass it with `--props`:

```bash
npx remotion still template-half-and-half out.jpg --props=edited-template.json
```

Every preview is drawn on a stand-in made for the library: a generated still of a presenter who does not exist (`public/style-samples/speaker.jpg`, made through Surplus's image endpoint), a drawn dashboard in SVG and a made-up line (`samples/`). No creator's footage is used.

## Adding a block

Copy the closest folder in `entries/`. Write the options with the reference's measured values as defaults, the content, the components, and the rules with the reason for each decision. Add the definition to `registry.ts`. `registry.test.ts` then checks the id, the defaults, the `showWhen` wiring, the preview slots and the copy. Render it, look at the first frame, the last frame and the middle, and compare against the reference before calling it done.

## Render engine

The Mac editor draws with AVFoundation, Core Animation and its own Core Image compositor. The web app has no video renderer. Neither Remotion nor Hyperframes was a dependency before this.

The library uses Remotion 4.0.545 as its first renderer, kept inside `style-runner/` so the web app's own dependencies are unchanged.

|                             | Remotion                                                                                                                                    | Hyperframes                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Licence                     | Source-available Remotion License                                                                                                           | Apache 2.0                                                  |
| Cost for Yapper today       | Free. The free licence covers companies of up to 3 people, including a commercial product and automated renders                             | Free                                                        |
| Cost past 3 people          | $0.01 per render with a $100 a month minimum (Automators). $25 a seat a month for hand-made videos (Creators). Enterprise from $500 a month | Free. HeyGen's hosted cloud renders are billed in credits   |
| Authoring                   | React components with props                                                                                                                 | HTML with data attributes and typed variables               |
| Age                         | Version 4.0.545. The player has been on npm since 2021                                                                                      | 0.9.83, first published March 2026                          |
| Preview in a web page       | `@remotion/player`, props change live                                                                                                       | `<hyperframes-player>`, no documented way to pass variables |
| Final render in the browser | Yes, stable since 4.0.491                                                                                                                   | Not documented. Needs Node, Chrome and FFmpeg               |

Remotion fits because the styles are React, the reference they come from is Remotion, and the player gives the gallery its live preview. Two things to know before leaning on it harder. Its licence does not allow users to upload their own Remotion code to be rendered on our service, so user-made styles have to stay option sets on our components unless the engine changes. And from Remotion 5.0 a company on the paid automated plan must set a licence key and send render telemetry.

Hyperframes is the natural second renderer, and its variable declarations (`id`, `type`, `label`, `default`) map onto the option specs here almost one to one.

Sources, read November 22, 2026: [Remotion licence](https://www.remotion.dev/docs/license), [pricing](https://www.remotion.dev/docs/license/pricing), [licence FAQ](https://www.remotion.dev/docs/license/faq), [telemetry](https://www.remotion.dev/docs/telemetry), [LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [client-side rendering](https://www.remotion.dev/docs/client-side-rendering); [Hyperframes repository and licence](https://github.com/heygen-com/hyperframes), [FAQ](https://hyperframes.heygen.com/faq), [variables](https://hyperframes.heygen.com/concepts/variables.md), [rendering](https://hyperframes.heygen.com/guides/rendering.md), [player](https://hyperframes.heygen.com/packages/player.md), [comparison with Remotion](https://hyperframes.heygen.com/guides/hyperframes-vs-remotion). The remotion.pro pricing page redirected to a dashboard and was not read.

## In the Mac editor

Decided November 25, 2026: a template reaches the Mac editor as the editor's own project values, compiled from the React entries. The entries stay the design source and keep drawing the gallery. `src/lib/style-library/native/` turns each template into a plan the editor already knows how to store and draw, and writes the plans to `native-macos/Sources/YapperNative/Resources/StyleTemplates/templates.json`, which ships inside the app. `native-catalog.test.ts` fails when that file is out of date; `UPDATE_NATIVE_STYLES=1 npx vitest run src/lib/style-library/native` rewrites it.

| Template part                         | Becomes in the editor                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `splits.half-and-half`                | `cameraRegion` on the project (the camera covers the bottom area and is cut to it), each clip's framing worked out from the zoom and focus, and the split's settings in `appliedStyle` |
| `overlays.media` in the top slot      | An ordinary overlay over the top area for the whole video, cropped to fill it                                                                                                          |
| The shared backdrop options           | The project backdrop: the dotted grid is the Grid preset, a flat colour is the colour                                                                                                  |
| `captions.plain-white`                | The project caption style and words per card, in the same fields `editor.captions.setStyle` takes                                                                                      |
| Drawn graphics (cards, the seam line) | Overlay scene JSON (`docs/overlay-scene-format.md`). Not compiled yet                                                                                                                  |

Why not overlay scene JSON for everything, which was the first lean: a scene draws shapes, text and pictures inside one overlay's box. A split moves where the camera itself is drawn, which no overlay can do. Captions are timed to words and already have their own style system. The top visual is the creator's own clip or screenshot, and a scene's pictures are limited to `brand.logo` and generated `image:<key>`, with no video. So scene JSON stays the target for drawn graphics only.

Why not render blocks to alpha video: the result is pixels, so nothing in it could be changed afterwards by hand, by Chirpy or over a connector, and every change would mean another render. Why not rewrite each block in Swift: two copies of every design drift apart. Compiling keeps one source, and the editor gains a new primitive only when a block needs something it cannot do yet. The camera region is the first.

Checked before deciding: the player and the export both draw the main track through the same composition instructions and `StudioVideoCompositor`, so cutting the footage to its region in one place reaches both. `StyleTemplateActionTests.splitRendersTheSameInPreviewAndExport` renders a split through the player's composition and through a real export and checks the pixels above and below the seam. A project with a region always uses the editor's own compositor, because AVFoundation's cannot clip a layer after placing it.

Inside a region a clip's `VideoFraming` keeps its meaning, measured against the region: scale 1 covers it, and `x` and `y` slide by fractions of its size. `CameraRegionFraming` converts the gallery's zoom and focus (CSS `object-fit: cover` with `object-position`) into that framing for the take's real shape.

Three client actions carry what belongs to the template itself, in `protocol/actions/editor-styles.json`: `editor.styles.apply`, `editor.styles.setSplit` (seam, camera zoom and focus, margin around the top visual) and `editor.styles.setTopVisual`. Everything else a template sets is an ordinary project value with an action it already had, so "make the captions yellow" after a template is `editor.captions.setStyle` and "change the background" is `editor.project.setBackdrop`. Chirpy plans over all of them. Applying a template is one undo step.

What the editor leaves out today, reported in the action's receipt: the blurred take and your own image or video as a backdrop (a flat colour stands in), the line on the seam, a card in the top slot, the speaker-below layout, and the caption weight (the editor's caption font has one weight).

The connector at `/api/mcp` cannot reach any of this. It runs server actions, and editor actions run inside the Mac app on the open project. Letting Claude or ChatGPT edit an open project needs an MCP server in the Mac app over `AppActionRegistry`, which is not built.

## Not built yet

A template covers one arrangement for as long as it is on screen. A video that cuts between a full frame and a split needs a timeline of templates, which does not exist yet.

Not verified: the connector against a real Claude or ChatGPT client, and Clerk's OAuth sign-in for it. Turning it on needs dynamic client registration enabled in the Clerk dashboard, `YAPPER_MCP=1`, and migration `0043` applied. The `/api/styles` routes and Chirpy's planner have not been run against a live database or a live model either, and Chirpy has no eval cases for looks.

Also not built: putting a look on a video, picking your own take or media in the gallery (it takes a pasted link today), a sidebar entry for the gallery, a preview a connector could show, and a limit on which media URLs a look may point at (needed before anything renders on a server). Inter is fetched from Google Fonts by the runner, and the Mac editor has system fonts only.
