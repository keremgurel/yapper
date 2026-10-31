# Chirpy and the shared app action system

Status: native contextual planning, project history and atomic edits are implemented, with general image masks, framing/crop keyframes, shared timing anchors and sound placement. Manual controls and Chirpy use the registered operations. Older number-reveal documents and clients remain compatible. The native catalog now includes bulk overlay framing and the additional editor operations below. Workspace/account operations and the web Studio migration remain separate work.

## Product contract

Anything a creator can do through an app control should be expressible through Chirpy. A feature should implement its behavior once. Its button, menu, keyboard shortcut, and assistant invocation must use the same validated action and receive the same result.

New actions still need a name, typed inputs, a description, availability rules, and implementation. These belong to the feature, not a second assistant integration. A model cannot reliably discover arbitrary Swift methods or React event handlers without that contract. Automatically exposing every method would also expose implementation details that are not valid user actions.

No custom model training is needed to establish this architecture. Model selection is a separate evaluation decision. The work is an application action system plus a model execution loop with context and feedback.

## Baseline before this migration

- Native `AssistantRouter` uses local text matching to choose a small intent enum. `EditorSession+Assistant.swift` dispatches those intents. Many branches already reuse editor methods, but new functionality still needs an assistant route.
- `AssistantConversation` stores ten messages as display receipts; the native command dispatcher does not send that history to a model.
- `ImageNumberReveal.requested` recognizes three groups of keywords. Its executor locates one explicitly mentioned imported image, performs OCR, matches values to nearby transcript words, and builds rectangles with opacity animations. It does not interpret exclusions in the request.
- The existing scene revision planner interprets an instruction, but it applies only to generated overlay editing, not the whole app.
- Web `StudioChirpy` has separate regular expressions for ideas, knowledge, essentials, and brand commands. `ChirpyBrainTools` is three page-bound closures used for UI synchronization, with REST fallbacks. It is not a model-visible capability registry.
- Editor methods already provide persistence, Undo, locks, cancellation, composition rebuilding, and rollback. Those implementations should be retained.

## One feature-owned action contract

Define a versioned action protocol that native and web feature modules implement. Each action registration contains:

| Field         | Purpose                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Stable ID     | For example, `editor.overlay.update` or `studio.idea.create`; independent of translated UI labels.                  |
| Description   | What the action does and when to use it.                                                                            |
| Input schema  | Typed arguments, explicit units, ranges, optional fields, and allowed values.                                       |
| Result schema | Actual affected IDs, before/after values, persistence status, and errors.                                           |
| Availability  | Whether it can run in the current scope, plus a reason when unavailable.                                            |
| Runtime       | `client` runs in the app's action registry; `server` runs inside the Chirpy turn loop.                              |
| Effects       | One value from the effect vocabulary below; destructive, external and standing-rule actions also need confirmation. |
| Executor      | The existing feature operation, including validation and persistence.                                               |

The same definition supplies model tool schemas, UI availability, and command discovery. Registration is the normal feature boundary. There must not be a parallel handwritten assistant catalog or an assistant-only switch over action IDs.

Native and web will have distinct executors using a common wire protocol. The hand-edited source is the set of group files in `protocol/actions/` (see where to add an action, below); `scripts/app-actions/generate.py` bundles them into `protocol/app-actions.schema.json` and generates Swift request/input/result types and TypeScript declarations from the bundle. CI rejects stale generated files. Swift validates inputs against the embedded generated schema before Codable decoding. The web executor is not implemented yet. Each runtime advertises its installed capabilities and protocol version. The server reasons over those capabilities; it does not pretend that every client version supports every action. Server-side operations independently enforce the signed-in user's access; a client-advertised catalog never grants authority.

For property inspectors, a property set is one action whose input carries any subset of a feature's fields, each with its type and range in the schema. Caption style, text layer style, static video framing, retouch, background, backdrop, and volume are registered this way (`editor.captions.setStyle`, `editor.text.setStyle`, `editor.video.setFraming`, `editor.retouch.set`, `editor.background.set`, `editor.project.setBackdrop`, `editor.audio.setVolume`). The executor writes the fields the inspector writes and reports before/after values per field from the encoded state, so a picker and Chirpy share one validator and one receipt shape. Discrete inspector controls and the end of a colour or fader gesture go through the action. A slider that streams while dragged still commits through the coalesced preview path; making that preview non-persisting so the final value also goes through the action is follow-up work, and those controls are listed as UI-only in the inventory. Complex actions such as transcription and export remain explicit operations rather than generic field writes.

## Where to add an action

Edit the group files in `protocol/actions/`, never the generated files. `python3 scripts/app-actions/generate.py` bundles the groups and writes four committed outputs: `protocol/app-actions.schema.json`, `protocol/app-actions.generated.ts`, `src/lib/chirpy/studio/registry.generated.ts` and `native-macos/Sources/YapperNative/Models/Actions/AppActionContract.generated.swift`. CI runs it with `--check` and fails on any difference.

| File                                                                                                                                                                                                                                       | What it holds                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common.json`                                                                                                                                                                                                                              | The bundle header, the `AppActionRuntime` and `AppActionEffect` vocabularies, and definitions used by more than one group (`ActionRect`, `TimelineAnchorInput`, `AnimationEase`, `OverlayKeyOperation`)                         |
| `chirpy-wire.json`                                                                                                                                                                                                                         | Invocation request, result and change envelopes, and the Chirpy plan reply                                                                                                                                                      |
| `editor-audio.json`, `editor-captions.json` (captions and text layers), `editor-overlays.json` (overlays and masks), `editor-project.json`, `editor-timeline.json`, `editor-transcript.json`, `editor-video.json`, `editor-workflows.json` | Client actions for one editor feature each, with their input definitions                                                                                                                                                        |
| `app-projects.json`, `app-dictionary.json`                                                                                                                                                                                                 | Client actions outside the open timeline: the project library and the account's transcription dictionary (see below)                                                                                                            |
| `studio-ideas.json`                                                                                                                                                                                                                        | Server actions for the Ideas tab: capture, rename, status, pillar, schedule, delete, drafts and versions, and the list's saved views (see Studio actions below). Each later Studio surface gets its own `studio-<surface>.json` |

Put a new action in the group that owns the feature. For a new feature, add `<namespace>-<feature>.json` with `description`, `runtime`, `actions` and `$defs`. Run the generator and commit the group file together with the regenerated outputs. When two branches that each add a group conflict in the generated files, keep either side and run the generator again.

The generator refuses a contract that breaks these rules:

- An action ID starts with its file's namespace (`editor-*.json` holds `editor.*` IDs), and the namespace fixes the group's `runtime`: `editor` and `app` are `client`, `studio` is `server`.
- The action's `input` is defined in the same file. Definitions may reference their own file and the two shared files only, so a definition that a second group needs moves to `common.json`.
- Definition names, action IDs and Swift symbols are unique across all files.
- Client actions carry a Swift `symbol` and `requiresRebuild`; server actions carry neither.
- `effect` comes from the table below, and `destructive`, `external` and `standingRule` actions must set `confirm: true`.

`runtime` is written once per group and copied onto every action in the bundle. Swift receives only the shared files and the client groups, so a Studio PR leaves the native build untouched. Server actions appear in the TypeScript contract and in `STUDIO_ACTIONS` in the Studio registry, where `StudioActionInputs` maps each ID to its input type. The v1 planning endpoint (`/api/chirpy/plan`) plans client actions only.

| Effect           | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `read`           | Returns state without changing it                                                  |
| `reversibleEdit` | Editor edit that one Undo reverts; client only                                     |
| `serverEdit`     | Saved change to the user's Studio data; server only                                |
| `paidGeneration` | Spends credits on a provider call                                                  |
| `destructive`    | Removes something Undo cannot bring back; needs `confirm`                          |
| `external`       | Acts on a connected platform or another outside service; needs `confirm`           |
| `standingRule`   | Sets up behaviour that keeps running later, such as an automation; needs `confirm` |
| `navigation`     | Changes what the app shows, such as the tab or the open idea                       |
| `workflow`       | Long operation that owns its transaction and runs alone                            |

The contract only describes the action. A client action still needs its availability and executor registered in the feature layer (for native, see `native-macos/README.md`). A server action needs an executor in `src/lib/chirpy/studio/<surface>/` (see Studio actions below).

### App actions (`app.*`)

`app.projects.*` (create, open, rename, duplicate, trash) and `app.dictionary.*` (add, edit, remove a term) are registered with `registerApp` and run by `AppScopeActions`, not inside the project's edit slot. They skip the revision check and are not part of Undo, because they change which project is open or something that is not in the project. A plan may hold one of them and nothing else: the native registry rejects a mixed batch and `parsePlanReply` on the server refuses one.

`confirm: true` in the contract (today only `app.projects.trash`) requires a confirmation question at registration. Only a Chirpy plan asks it, as a native alert through `EditorSession.confirmAssistantAction`; clicking the control is already the creator's decision. Cancel returns a `canceled` receipt and changes nothing.

A project change that Chirpy asks for waits until its turn has finished (`changeProjectsAfterAssistantTurn`), so the turn files its receipt in the project it started in and is not canceled by `openProject`. The checks run first (the project exists, it is not uploading, the creator confirmed), so the receipt says what is about to happen: "Opening …", "Moving … to the Trash". The projects grid, the File menu, the Poster grid and the dictionary panel call the same actions through `performAppAction`, and run at once.

Chirpy's context lists `projectLibrary` (the newest 50 projects: id, name, updatedAt, open) and `dictionary` (term and aliases). Other projects' contents never enter it.

### Studio actions (`studio.*`)

Studio tabs plan with their own endpoint, `POST /api/chirpy/studio`, while the editor keeps `/api/chirpy/plan`. A turn sends the conversation, the tab (`surface`), the creator's time zone and, when an idea is open, its id. The client never uploads account data: `readStudioOverview` reads the creator's pillars, saved views and a selection of ideas (the 30 most recently updated, up to 10 older ones whose words match the last two messages, and the open one) from the database, with calendar dates written in the creator's zone and the next eight days listed by weekday. The prompt keeps the static system text and the Studio catalog first, so they come from the provider's cache, and puts that overview and the conversation last.

Planning runs once under `withPlanLedger` (two credits, idempotent by execution ID, one repair call at most). The plan's actions then run on the server after the ledger commits, in order, each through an executor in `src/lib/chirpy/studio/<surface>/` that calls the same operation as the tab's own control: `src/lib/ideas/operations/`, `src/lib/content/operations/` and `src/lib/views/operations/` hold what used to be inline in `/api/ideas`, `/api/ideas/expand`, `/api/content/[id]`, `/api/content/bulk`, the version write route and `/api/views`. Paid actions charge their usual credits through those operations; `studio.ideas.capture` writes the first draft like the composer and costs `expand_idea` unless the creator asks to just save the note. Executing outside the ledger matters: the ledger's credit reserve holds the creator's balance row until it commits, so a paid action inside it would wait on itself.

Each action has an invocation ID derived from the turn's execution ID and its position. Its receipt is a row in `chirpy_plans` keyed by that ID, claimed with an insert before the executor runs, so a retried turn reports the saved result instead of running the change again, and a failure is saved too rather than retried. After a failure the rest of the plan is skipped. Actions with `confirm: true` (deleting ideas, versions and views) are saved as pending instead. The reply carries a confirmation (`question`, `confirmLabel`, and a `typedHint` for a thread with no buttons), and only `POST /api/chirpy/confirm` runs them: no model call, no credit, at most once, within 30 minutes. A bare typed "yes" or "no" sent to `/api/chirpy/studio` answers the latest pending confirmation the same way, which is how the Mac's text thread confirms.

The reply is `{message, tone, notes, results, confirm?, effects}`. `message` is the model's sentence only when every action succeeded; otherwise it is the failing action's own explanation. `notes` are the receipts. `effects` names what changed (`ideas`, `ideaViews`): the web panel reloads the matching `STUDIO_RESOURCE_KEYS` through `reloadClientResource`, which also makes mounted pages refetch, and the Mac reloads `IdeasStore`, `CalendarStore` and `IdeaViewsStore`. The Mac's non-editor tabs still reach Chirpy through `window.__yapperNativeChirpy` in the hidden web view; it returns the same `{text, notes, tone}` with the confirmation question and hint folded into `text` and an added `effects` list, so installed builds pick the new planner up from a server deploy and only skip the store refresh.

`src/lib/chirpy/route-coverage.ts` lists every mutating export under `src/app/api/**/route.ts`: mapped to the actions that do the same thing, excluded with a reason (billing, webhooks, OAuth, uploads, Chirpy's own routes, admin, sign-in handoff, one-time migrations, POSTs that only read, retired routes), or waiting in `UNCOVERED_ROUTES` for its surface's PR. `route-coverage.test.ts` fails on a route in none of them, on a stale entry, and on an action id the contract does not have. A new Studio surface adds `protocol/actions/studio-<surface>.json`, its executors and reads under `src/lib/chirpy/studio/<surface>/` with a table merged into `STUDIO_EXECUTORS`, moves its routes from `UNCOVERED_ROUTES` to `ROUTE_ACTIONS`, adds a line to the Studio prompt, and adds eval cases with `planner: "studio"`.

## Decisions settled before implementation

- **Topology:** the native client posts current context and its discovered catalog to authenticated `POST /api/chirpy/plan`. The backend returns a validated plan; the native registry executes it and shows actual receipts. The next user turn includes those receipts and fresh state. Planning uses one provider call plus at most one schema-repair call inside the same 40-second deadline, with at most eight deterministic actions, instead of an autonomous six-call loop. Generation/transcription workflows run alone because they own their transaction and operation lease. No new sentence router or assistant-only action switch is needed when a feature registers an action.
- **Scope:** Swift macOS first. Existing Studio requests retain their web bridge. Web action registration, cache invalidation, and persisted web history are still a separate migration; Tauri is excluded. The native catalog currently includes clip speed, clip/caption locks, caption visibility, region visibility, reveal sounds, manual mask creation/editing/removal, overlay crop/keyframes/animated zoom, audio extraction, transcription, silence trimming, one-click cleanup, overlay design, speech-timed speaker punch-ins, the property sets below, timeline editing (split, delete, trim, reorder, shift, transcript word and pause cuts), and caption and text layer operations (add, remove, merge, rewrite, retime, text add and update) (54 registered actions, including two legacy compatibility actions).
- **Accounting:** `PAID_ACTIONS.chirpy_plan` costs two credits. Live evaluation uses `gpt-5.4` unless `AI_CHIRPY_MODEL` overrides it. Provider work has a 40-second budget, 6,000 output-token cap, and bounded request/reply sizes. A PostgreSQL transaction serializes each authenticated user/execution pair, reserves the credit, and commits the validated plan with its debit. Provider failure rolls the reservation back. Duplicate requests return the saved response; changed payloads under an existing execution ID return conflict. Local button actions are free. Existing paid workflows retain their own charges. The composer discloses the planning charge.
- **Persistence:** `chirpy-history.json` lives inside the project package, outside Undo. It keeps the last twenty messages and sixty-four action receipts, plus pending invocation IDs. Reopening loads it; switching projects isolates it. A journal entry is saved before execution. Interrupted invocations are not replayed automatically. Planning context includes a launch session ID and monotonic revision; a project change during reading, planning, or edit-slot acquisition rejects the plan. Closing Chirpy cancels planning and tracked editing work.
- **Web propagation:** planned web executors will update affected `STUDIO_RESOURCE_KEYS` and live outside page-mounted React refs. This release does not claim web action parity.
- **Operation ownership:** deterministic batches hold one outer lease and edit slot, execute mutations without intermediate saves, then rebuild/persist/record one Undo entry. A later failure rolls the whole batch back. Existing generation workflows keep their own transaction boundary and cannot be mixed into an atomic deterministic batch. This avoids nested leases and accidental intermediate Undo entries.

## General editing primitives

The feature contract, not the phrase a user happens to say, defines the action catalog. Chirpy composes the available capabilities from current state, source-image evidence, conversation and action receipts. Adding a feature requires registering its typed operation once; it must not require another intent enum case, keyword rule, bespoke assistant workflow or prompt example.

- `editor.masks.setRegion` creates or edits any rectangular solid cover on an image or image-backed scene. Normalized source geometry, RGB color, and arbitrary ordered opacity keyframes are editable in **Overlays → Masks**. Opacity 1 covers the region and 0 exposes it; an initial key explicitly supplies the state before the transition. Original pixels remain intact. A geometry-only edit preserves existing animation. `editor.masks.remove` removes only the named region.
- `editor.video.animateFraming` authors ordered relative scale, position and rotation keys across video clips. **Video → Animate framing…** exposes those same parameters. Quick zoom in/out is a manual preset that fills in ordinary keys, not an assistant action. First and last identity keys begin and return to existing framing. Other tracks and keys outside the interval remain intact; normal interpolation applies between neighboring keys.
- `editor.audio.addAt` places library sounds at shared timing anchors. The sound-library button uses the same action at the playhead. Repeated placement of the same effect at the same time is a no-op.
- Overlay crop/placement keyframe operations remain available. **Zoom into area…** is a convenience operation that creates editable crop keys while preserving the outer frame and source image. Smooth easing survives inserted keys and splits.

`TimelineAnchorInput` is shared by framing, mask opacity and audio: explicit time, playhead, first kept speech, exact phrase/occurrence, or a saved animation event, plus a seconds offset. Local resolution handles cuts, source trims and playback rates. Missing phrases and ambiguous repeated phrases reject before mutation. The first spoken word needs no supplied phrase or timestamp. An `animationEvents` entry identifies a saved mask opacity keyframe and its actual timeline time; an opacity-zero endpoint means the cover is fully transparent. Legacy fade-start events remain available only through the compatibility action.

Source-image vision is independent of OCR: text, logos and other regions use the same geometry. Native context supplies `masks`, `animationEvents`, a bounded JPEG of the selected overlay's original pixels, and general Vision text/rectangle observations. Detected geometry is evidence, not a saved mask ID; OCR never determines which subjects are supported. It does not advertise a special number-reveal capability. Persisted `SavedRevealRegion` / `revealRegions` names remain decoding adapters for old documents; optional `opacityKeys` store the general animation. Legacy `editor.reveals.setPolicy` and `editor.sounds.addAtReveals` remain executable by older clients but are excluded from new native planning catalogs.

Limits are part of the capability description and validated locally: rectangular solid masks on images/scenes; 0.5–30 second source-scene duration; no blur, arbitrary paths, moving-object tracking or video-face masks. Face framing detects a face at the start of each affected clip and keeps its screen point fixed while scaling; it does not track motion. Without a detected face the receipt reports a center pivot. Locked clips, unsupported scale changes, out-of-range or reversed timing fail without partial edits.

The planner defaults to `gpt-5.4` (overridable via `AI_CHIRPY_MODEL`): provider-backed comparisons found the mini model less reliable at resolving available speech anchors. This increases provider cost; the existing one-credit planning reservation remains unchanged. Model choice is based on these bounded editing evaluations, not a claim of universal accuracy.

Chirpy must explain unavailable functionality, and can offer a supported alternative or suggest requesting a feature. It must not apply a substitute or claim a feature request was filed without a real submission capability. Success text comes from persisted action receipts, not model intent.

Verification covers generic nonnumeric masks with conceal/expose/conceal opacity animation, actual rendered pixels at source-rate changes, geometry edits retaining keys, event-aligned audio, immutable originals, persistence/Undo, speech matching across cuts, framing curves and both export compositor paths. Provider evaluations include speech-start and phrase framing, nonnumeric masks, general event sounds, legacy compatibility and unsupported tracked blur.

## Editor coverage added after the full-frame failure

The manual Full frame control existed without a corresponding Chirpy action. The planner also treated mentions of overlays too broadly as placement requests, and any invalid plan or provider failure became the same `planning_failed` response. The screenshot alone cannot distinguish those server failure causes.

The shared contract now registers 16 additional actions:

| Capability                                                                          | Action                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------- |
| Bulk full frame, card fit, position, dimensions, rotation; optional single keyframe | `editor.overlays.setFrame`                  |
| Visibility, depth, source start, timing and lane                                    | `editor.overlays.setProperties`             |
| Place a known imported item at an anchor                                            | `editor.overlays.add`                       |
| Hide/show or remove an overlay lane                                                 | `editor.overlays.editTrack`                 |
| Aspect ratio, filter, track visibility/mute                                         | `editor.project.setSettings`                |
| Append, remove or reset imported media                                              | `editor.media.edit`                         |
| Move between main and overlay tracks                                                | `editor.timeline.transfer`                  |
| Absolute video framing key add/remove/move/clear                                    | `editor.video.framingKey`                   |
| Replace sounds or trim their source                                                 | `editor.audio.replace`, `editor.audio.trim` |
| Split a caption at a word boundary                                                  | `editor.captions.splitAtWord`               |
| Clear video or caption tracks                                                       | `editor.timeline.clearTrack`                |
| Undo/Redo                                                                           | `editor.history.restore`                    |
| Import through the existing file picker                                             | `editor.media.import`                       |
| Export through the existing save panel, or explicitly send to Poster                | `editor.export`                             |
| Place a saved library sound at an anchor                                            | `editor.audio.addSaved`                     |

`all: true, overlayIDs: []` applies one overlay action to every current overlay, including hidden items on every lane. A whole-span frame change updates placement keys while preserving crop keys, easing, timing, media identity and source trim. A `time` targets one overlay-local keyframe. Bulk edits do not consume one action per overlay. The native Full frame/Card buttons use this executor; live drags retain their coalesced commit behavior. Lane toggles resolve their state inside the existing serialized queue so rapid double toggles retain parity; the action and toggle share the visibility transformation.

Planning distinguishes editing existing overlays from placing unused media. One invalid plan can be repaired before execution, with the same deadline and one ledger reservation. The server returns bounded failure codes for invalid plans, truncation, timeout and provider failure instead of hiding all of them behind `planning_failed`. Failed planning rolls back its credit reservation. Older native builds do not advertise the new actions and must be updated; a server-only deployment cannot grant those capabilities.

Verification includes a real provider test of the reported follow-up with 12 overlays and an unused import, native button/action equivalence, one-save bulk edits, Undo/Redo, crop-key preservation, invalid targets, atomic batch rollback, persistence failure, media transfers/locks, video keys, audio replacement and source bounds. Project-library navigation/deletion, account dictionary management, global audio-library management, and the web Studio action migration remain outside this editor change; this is not a claim that every control across the whole product is registered.

## Target context and execution loop (beyond the bounded first release)

1. Capture the active workspace/project, its revision, current page, selection, playhead, and recent conversation and action results.
2. Present the model with relevant available actions. Provide search/describe tools for the full catalog, so relevance filtering cannot make a feature inaccessible.
3. Let it read state or request focused evidence: transcript spans, overlay scene nodes, image regions, or rendered frames. Avoid sending an entire project or video on every turn.
4. Resolve references to stable IDs. A supplied `@` reference is useful but optional when selection or recent results identify the object. Ask a focused question only when the target remains ambiguous.
5. Validate proposed arguments locally and check the project revision and action availability again immediately before execution.
6. Execute through the shared feature operation. Return structured results after persistence settles; a model's proposed action is not proof of success.
7. Feed results and updated state back to the model. Continue dependent steps sequentially, then explain what actually changed.

Bound turns by model calls, elapsed time, provider spend, and action count. Cancellation must stop further actions and use the current operation's rollback behavior. Do not retry an uncertain mutation without an execution ID and a recorded result.

Conversation belongs to a project/workspace scope. Keep recent dialogue and compact summaries of completed actions, with affected IDs. On project switch, invalidate old references and cancel pending work for the old project. Preserve an explicit distinction between user instructions and untrusted transcript, document, and image content.

Normal reversible edits should run under the same rules as their UI controls. Publication and other external effects retain their existing review and authorization requirements. Do not introduce a generic approval dialog for every edit.

## The Google Ads correction as an acceptance case

The imported image and the generated reveal are separate resources linked by `revealSourceMediaID`. Keep that link and store detected regions as editable metadata rather than treating rectangle IDs as the only explanation of what is hidden.

Each region needs a stable ID, recognized value, rectangle, confidence, and an associated metric label when confidently identified. Its reveal policy should distinguish `alwaysVisible`, `untilCue`, and an explicitly requested `alwaysHidden`. If label association is ambiguous, inspect the image or ask which region; do not infer CPC solely from a currency value.

For "keep CPC and impressions visible throughout":

1. Resolve the overlay from selection or the preceding successful reveal action.
2. Read its regions and visibility policies.
3. Remove those two covers through `editor.masks.remove`, the same operation as the inspector. Legacy clients can still set their policy to `alwaysVisible`.
4. Leave cost/click reveal cues, image pixels, placement, dimensions, and unrelated animations unchanged.
5. Save a new immutable scene version, verify representative frames, and record one Undo operation.

The existing correction that leaves all unmatched values visible is a good default for initial generation. It is not a replacement for selective region editing, and changing the source code does not automatically repair previously saved scenes.

## Migration sequence

### 1a. Register existing editor actions (implemented)

The feature registry owns clip speed, clip/caption locks, and caption visibility. UI entry points and existing Chirpy command translations reach the same registry and persistence transaction. Typed arguments resolve selection to explicit IDs before execution. Unknown actions, extra arguments, invalid values, missing targets, wrong projects, and stale revisions are rejected. The registry rechecks state after waiting for the edit slot, reports committed before/after property changes and skipped targets, and preserves rollback and Undo. Caption toggles preserve their existing queue behavior; structured actions set an explicit visibility state.

At this checkpoint the keyword router remained an input adapter, without a model call. Tests compare UI and assistant saved state and exercise registration/discovery, no-op results, rejection, persistence failure, cancellation, and Undo/Redo. Step 1b now replaces that native input adapter with contextual planning.

### 1b. Add contextual model execution (bounded release implemented)

Native requests now use the discovered action catalog, project context, persistent conversation, and server execution/credit ledger. Paraphrases and contextual follow-ups have been tested against a real provider separately from executor tests. This release returns one bounded plan per user turn; result-based replanning happens on the next user turn. Autonomous multi-call execution remains future work.

This slice proves the mechanism. It must be described as a partial migration until the inventory below is complete.

### 2. Make overlay edits addressable (masks, crop, keyframes, zoom, policies, and reveal sounds implemented)

Expose overlay inspection, placement, transforms, timing, and scene changes through the registry. Add region visibility metadata and an inspector control. Wrap OCR, cue binding, and rendered review as reusable feature services. Replace the spoken-number keyword branch with structured action arguments.

### 3. Migrate the rest of the native editor

Cover timeline selection and navigation; trims, splits, reorder and speed; captions and text; audio and sound effects; crop, framing and keyframes; retouch and backgrounds; media import/relink; project management; export and Undo/Redo. Audit controls rather than assuming that migrating the old intent enum covers the application.

### 4. Connect web Studio through the same protocol

Move Brain, brand, ideas, scripts, media, and publishing actions out of command regular expressions. Register actions at the feature/service boundary so they remain discoverable when their page is not mounted. Native execution can bridge a Studio action to its proper web/server runtime while preserving workspace and authorization scope.

Ideas went first (2026-10-30): its actions, the Studio endpoint, confirmations and the route coverage gate are described under Studio actions above, and the idea regex in `studio-chirpy.tsx` is gone. Requests on the Ideas, Calendar and library tabs, and short requests elsewhere that mention ideas, now go to `/api/chirpy/studio`. The Brain and brand regex commands and the `/api/brain/ask` fallback stay until their surfaces get actions.

### 5. Enforce the contract for future features

Require domain-changing controls to invoke registered actions or registered property descriptors. Keep an explicit audited list of UI-only interactions, such as hover and drag previews; the committed result of a drag still goes through an action.

The native gate is in CI (2026-10-30): `python3 scripts/app-actions/inventory.py --check` fails when a control in `Views/`, `App/` or `Studio/` calls a session method that changes saved state without reaching `performAppAction`, unless the method is listed in `scripts/app-actions/unregistered-baseline.json` with its reason. It also fails when a listed method no longer needs to be there, so the list only shrinks. Views cannot call `updateProject` or the commit seams directly (`project` is `private(set)`), so the gate works at the level of the session methods they call. The baseline started at 56 entries; most name the existing action the control should route through.

On web, ESLint restricted imports should stop migrated components importing domain REST mutation clients directly. No web component is migrated yet, so that rule waits for the web Studio migration (step 4).

## Completion evidence

- UI and assistant invocations produce equivalent saved project state for identical arguments.
- A newly registered test action becomes discoverable and executable without editing router code, model prompts, or a second catalog.
- "Those two should stay visible" works after a reveal, including after replaying saved project context; unrelated nodes and timings remain equal.
- Unknown IDs, stale project revisions, invalid parameters, locked targets, and wrong-workspace actions cause no mutation.
- Failed persistence and canceled edits do not produce success receipts. Multi-step failures report what was completed and what was rolled back.
- Undo/Redo restores the same state for UI and assistant edits. Compound operations use explicit transaction grouping; the single-slot operation coordinator and intermediate history recording must be handled explicitly before claiming one Undo step per entire assistant request.
- Paid generation retains reservation/refund rules; model planning has its own measured and bounded cost. Deterministic button actions do not require a provider connection.
- Native/web version mismatch reports unsupported capabilities rather than falling back to an unrelated edit.
- Representative rendered output is checked for visual operations, and provider-backed evaluations cover paraphrases, exceptions, follow-ups, and mixed requests in addition to deterministic executor tests.

The sound-effects acceptance case must also be included: after the Google Ads reveal, "add click sound effects when we reveal the clicks and cost" should bind two sound instances to the saved reveal events at 6.524 seconds and 8.249 seconds in the current ep12 fixture. It must not add or move visual overlays. The legacy path failed this test and was undone. The compatibility event action preserves the original fade-start timing. New clients use general opacity events and audio timing anchors without routing the request to visual design.

The migration is complete only when the app action inventory is covered, the old command-routing dependency is removed from those paths, and the behavior has been verified in the running native app and web Studio.

## Imported overlay suggestion

The native editor's empty conversation includes **Place imported overlays** with
an example of a descriptive filename. The same shortcut remains available in an
ongoing editor conversation when imports exist, Chirpy is idle and the draft is
empty. Picking it only fills and focuses the composer; the creator reviews and
sends it explicitly. The example targets unused imports, preserving the main
video and avoiding duplicate overlays.

For requests to choose placements from filenames and speech, Chirpy asks for
descriptive names or a file-to-subject explanation when the requested files have
only camera counters, dates or generic names. It names the unclear files and
returns no actions, including for a mixed batch. Main-track and already placed
media are not candidates for this check. A user-provided description is enough;
Chirpy passes that mapping into the placement workflow after clarification.
Direct placements at an explicit anchor and edits to existing overlays do not
require descriptive filenames. This is a planner instruction, evaluated against
live model responses, not a claim that imported videos have been visually analyzed.
