# Chirpy and the shared app action system

Status: the native contextual action path is implemented on `codex/chirpy-action-registry`, including persistent project history, atomic deterministic action batches, and the Google Ads reveal-policy/sound workflow. This is the first native vertical slice; the full native action inventory and web Studio action migration below remain follow-on work.

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

| Field         | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Stable ID     | For example, `editor.overlay.update` or `studio.idea.create`; independent of translated UI labels. |
| Description   | What the action does and when to use it.                                                           |
| Input schema  | Typed arguments, explicit units, ranges, optional fields, and allowed values.                      |
| Result schema | Actual affected IDs, before/after values, persistence status, and errors.                          |
| Availability  | Whether it can run in the current scope, plus a reason when unavailable.                           |
| Effects       | Read, reversible edit, navigation, generation, export, or external publication.                    |
| Executor      | The existing feature operation, including validation and persistence.                              |

The same definition supplies model tool schemas, UI availability, and command discovery. Registration is the normal feature boundary. There must not be a parallel handwritten assistant catalog or an assistant-only switch over action IDs.

Native and web will have distinct executors using a common wire protocol. The source of truth is `protocol/app-actions.schema.json`; `scripts/app-actions/generate.py` generates Swift request/input/result types and TypeScript declarations. CI rejects stale generated files. Swift validates inputs against the embedded generated schema before Codable decoding. The web executor is not implemented yet. Each runtime advertises its installed capabilities and protocol version. The server reasons over those capabilities; it does not pretend that every client version supports every action. Server-side operations independently enforce the signed-in user's access; a client-advertised catalog never grants authority.

For property inspectors, reusable property descriptors should carry type, range, label, getter, setter, and selection applicability. This lets a slider and a model update the same property without duplicating validation. Complex actions such as transcription and export remain explicit operations rather than generic field writes.

## Decisions settled before implementation

- **Topology:** the native client posts current context and its discovered catalog to authenticated `POST /api/chirpy/plan`. The backend returns a validated plan; the native registry executes it and shows actual receipts. The next user turn includes those receipts and fresh state. This release deliberately uses one planning call per user turn, with at most eight deterministic actions, instead of an autonomous six-call loop. Generation/transcription workflows run alone because they own their transaction and operation lease. No new sentence router or assistant-only action switch is needed when a feature registers an action.
- **Scope:** Swift macOS first. Existing Studio requests retain their web bridge. Web action registration, cache invalidation, and persisted web history are still a separate migration; Tauri is excluded. The native catalog currently includes clip speed, clip/caption locks, caption visibility, region visibility, reveal sounds, transcription, silence trimming, one-click cleanup, and overlay design.
- **Accounting:** `PAID_ACTIONS.chirpy_plan` costs one credit, matching the existing lightweight retiming/planning price. Live evaluation uses `gpt-5.4-mini` unless `AI_CHIRPY_MODEL` overrides it. Provider work has a 40-second budget, 2,200 output-token cap, and bounded request/reply sizes. A PostgreSQL transaction serializes each authenticated user/execution pair, reserves the credit, and commits the validated plan with its debit. Provider failure rolls the reservation back. Duplicate requests return the saved response; changed payloads under an existing execution ID return conflict. Local button actions are free. Existing paid workflows retain their own charges. The composer discloses the planning charge.
- **Persistence:** `chirpy-history.json` lives inside the project package, outside Undo. It keeps the last twenty messages and sixty-four action receipts, plus pending invocation IDs. Reopening loads it; switching projects isolates it. A journal entry is saved before execution. Interrupted invocations are not replayed automatically. Planning context includes a launch session ID and monotonic revision; a project change during reading, planning, or edit-slot acquisition rejects the plan. Closing Chirpy cancels planning and tracked editing work.
- **Web propagation:** planned web executors will update affected `STUDIO_RESOURCE_KEYS` and live outside page-mounted React refs. This release does not claim web action parity.
- **Operation ownership:** deterministic batches hold one outer lease and edit slot, execute mutations without intermediate saves, then rebuild/persist/record one Undo entry. A later failure rolls the whole batch back. Existing generation workflows keep their own transaction boundary and cannot be mixed into an atomic deterministic batch. This avoids nested leases and accidental intermediate Undo entries.

## Implemented reveal workflow

`GeneratedOverlayRecord.revealRegions` saves stable region IDs, OCR text and labels, confidence, boxes, background colors, policies, and scene-relative cues. Legacy reveals are inspected from their original saved pixels and current animations without rewriting them. `editor.reveals.setPolicy` changes only explicitly targeted masks; existing animations for other regions and the overlay's placement stay intact. When a media asset is shared, the selected instance receives its own version. `editor.sounds.addAtReveals` resolves event IDs against saved animation times, adjusted for source trim and playback rate. Repeating the same sound at the same event is a no-op. The overlay inspector exposes the same actions manually.

Acceptance is covered at three levels: contract/model tests, native persistence/Undo tests, and an installed-app check. Live model tests cover the reported impressions/CPC correction, the exact click-sound request, and the follow-up “those two reveals.” PostgreSQL tests cover duplicate requests, failed provider calls, and exhausted credits. `scripts/package-app.sh` embeds `YapperBuildCommit` to identify the installed source.

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
3. Set those two regions to `alwaysVisible` through the same action exposed in the overlay inspector.
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

### 2. Make overlay edits addressable (region policies and reveal sounds implemented)

Expose overlay inspection, placement, transforms, timing, and scene changes through the registry. Add region visibility metadata and an inspector control. Wrap OCR, cue binding, and rendered review as reusable feature services. Replace the spoken-number keyword branch with structured action arguments.

### 3. Migrate the rest of the native editor

Cover timeline selection and navigation; trims, splits, reorder and speed; captions and text; audio and sound effects; crop, framing and keyframes; retouch and backgrounds; media import/relink; project management; export and Undo/Redo. Audit controls rather than assuming that migrating the old intent enum covers the application.

### 4. Connect web Studio through the same protocol

Move Brain, brand, ideas, scripts, media, and publishing actions out of command regular expressions. Register actions at the feature/service boundary so they remain discoverable when their page is not mounted. Native execution can bridge a Studio action to its proper web/server runtime while preserving workspace and authorization scope.

### 5. Enforce the contract for future features

Require domain-changing controls to invoke registered actions or registered property descriptors. Keep an explicit audited list of UI-only interactions, such as hover and drag previews; the committed result of a drag still goes through an action. Add a native lint that rejects new calls to `updateProject`, `commitTimelineEdit`, and prepared-commit seams from views, with an audited baseline for unmigrated controls. On web, use ESLint restricted imports to prevent migrated components from importing domain REST mutation clients directly. Keep these checks scoped until the existing UI mutation inventory is migrated; the initial CI check verifies generated contract freshness only.

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

The sound-effects acceptance case must also be included: after the Google Ads reveal, "add click sound effects when we reveal the clicks and cost" should bind two sound instances to the saved reveal events at 6.524 seconds and 8.249 seconds in the current ep12 fixture. It must not add or move visual overlays. The legacy path failed this test and was undone. The new reveal-event action and contextual planner cover this case without routing it to visual design.

The migration is complete only when the app action inventory is covered, the old command-routing dependency is removed from those paths, and the behavior has been verified in the running native app and web Studio.
