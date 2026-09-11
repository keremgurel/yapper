# Chirpy and the shared app action system

Status: proposed architecture, grounded in the current native and web implementations. This document does not mean the migration has shipped.

## Product contract

Anything a creator can do through an app control should be expressible through Chirpy. A feature should implement its behavior once. Its button, menu, keyboard shortcut, and assistant invocation must use the same validated action and receive the same result.

New actions still need a name, typed inputs, a description, availability rules, and implementation. These belong to the feature, not a second assistant integration. A model cannot reliably discover arbitrary Swift methods or React event handlers without that contract. Automatically exposing every method would also expose implementation details that are not valid user actions.

No custom model training is needed to establish this architecture. Model selection is a separate evaluation decision. The work is an application action system plus a model execution loop with context and feedback.

## What exists today

- Native `AssistantRouter` uses local text matching to choose a small intent enum. `EditorSession+Assistant.swift` dispatches those intents. Many branches already reuse editor methods, but new functionality still needs an assistant route.
- `AssistantConversation` stores ten messages as display receipts; the native command dispatcher does not send that history to a model.
- `ImageNumberReveal.requested` recognizes three groups of keywords. Its executor locates one explicitly mentioned imported image, performs OCR, matches values to nearby transcript words, and builds rectangles with opacity animations. It does not interpret exclusions in the request.
- The existing scene revision planner interprets an instruction, but it applies only to generated overlay editing, not the whole app.
- Web `StudioChirpy` has separate regular expressions for ideas, knowledge, essentials, and brand commands. `ChirpyBrainTools` already provides a small example of registered capabilities, but command discovery is still manually routed.
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

Native and web have distinct executors but use the same wire protocol. Each runtime advertises its installed capabilities and protocol version. The server reasons over those capabilities; it does not pretend that every client version supports every action. Server-side operations independently enforce the signed-in user's access; a client-advertised catalog never grants authority.

For property inspectors, reusable property descriptors should carry type, range, label, getter, setter, and selection applicability. This lets a slider and a model update the same property without duplicating validation. Complex actions such as transcription and export remain explicit operations rather than generic field writes.

## Context and execution loop

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

### 1. Establish a complete vertical slice

Implement the action contract, registry, execution results, and context protocol. Move clip speed, clip/caption locks, and caption visibility into registered actions used by both UI controls and Chirpy. Add a model loop and history so ordinary paraphrases and contextual follow-ups work without new matcher rules.

This slice proves the mechanism. It must be described as a partial migration until the inventory below is complete.

### 2. Make overlay edits addressable

Expose overlay inspection, placement, transforms, timing, and scene changes through the registry. Add region visibility metadata and an inspector control. Wrap OCR, cue binding, and rendered review as reusable feature services. Replace the spoken-number keyword branch with structured action arguments.

### 3. Migrate the rest of the native editor

Cover timeline selection and navigation; trims, splits, reorder and speed; captions and text; audio and sound effects; crop, framing and keyframes; retouch and backgrounds; media import/relink; project management; export and Undo/Redo. Audit controls rather than assuming that migrating the old intent enum covers the application.

### 4. Connect web Studio through the same protocol

Move Brain, brand, ideas, scripts, media, and publishing actions out of command regular expressions. Register actions at the feature/service boundary so they remain discoverable when their page is not mounted. Native execution can bridge a Studio action to its proper web/server runtime while preserving workspace and authorization scope.

### 5. Enforce the contract for future features

Require domain-changing controls to invoke registered actions or registered property descriptors. Keep an explicit audited list of UI-only interactions, such as hover and drag previews; the committed result of a drag still goes through an action. Add a CI check and review requirement preventing new direct domain mutations in views from silently bypassing the registry.

## Completion evidence

- UI and assistant invocations produce equivalent saved project state for identical arguments.
- A newly registered test action becomes discoverable and executable without editing router code, model prompts, or a second catalog.
- "Those two should stay visible" works after a reveal, including after replaying saved project context; unrelated nodes and timings remain equal.
- Unknown IDs, stale project revisions, invalid parameters, locked targets, and wrong-workspace actions cause no mutation.
- Failed persistence and canceled edits do not produce success receipts. Multi-step failures report what was completed and what was rolled back.
- Undo/Redo restores the same state for UI and assistant edits. Compound operations use explicit transaction grouping; existing nested operation leases must be adapted before claiming one Undo step per entire assistant request.
- Paid generation retains reservation/refund rules; model planning has its own measured and bounded cost. Deterministic button actions do not require a provider connection.
- Native/web version mismatch reports unsupported capabilities rather than falling back to an unrelated edit.
- Representative rendered output is checked for visual operations, and provider-backed evaluations cover paraphrases, exceptions, follow-ups, and mixed requests in addition to deterministic executor tests.

The migration is complete only when the app action inventory is covered, the old command-routing dependency is removed from those paths, and the behavior has been verified in the running native app and web Studio.
