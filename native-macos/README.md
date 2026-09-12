# Yapper Studio Native

Mac-first native video editor prototype built with Swift, AppKit/SwiftUI,
AVFoundation, Core Media, and Core Animation. It lives beside the current web
and Tauri apps while the performance-critical editor is migrated.

## Run in development

```bash
swift run YapperNative
```

## Test

```bash
swift test
```

When the DJI reference media is mounted, the test suite also builds a 50-cut
continuous AVFoundation composition and exports a short cut whose audio track is
verified before the test passes.

## Package

```bash
./scripts/package-app.sh
```

The result is `dist/Yapper Studio Native.app`. The native editor uses one
continuous composition for playback; it never pause/plays separate video
elements at clip boundaries.

## Shared app actions

Chirpy now sends the current project, selection, saved reveal events, and recent
project conversation to `/api/chirpy/plan`. The model sees the catalog generated
from `AppActionRegistry`. It can propose up to eight deterministic actions in
one atomic edit, or one existing generation workflow. Replies come from committed
execution results. Closing Chirpy cancels pending planning and editing work.

Clip speed, locks, caption visibility, and number-reveal policies/sounds share
executors with their UI controls. Existing transcription, cleanup, silence trim,
and visual design workflows are registered separately and retain their own
transactions. The remaining native controls and web Studio migration are tracked
in `docs/chirpy-shared-actions.md` at the repository root.

Conversation lives in `chirpy-history.json` within each project package and is
independent of Undo. Planning costs one credit per user turn; deterministic local
button actions are free. Deploy migration `0028_chirpy_plans` with the planning
endpoint before distributing this native build. The package script embeds the
source revision in the app's `YapperBuildCommit` Info.plist key.

To add a registered feature, define its action and input in
`protocol/app-actions.schema.json`, regenerate the Swift and TypeScript contract,
then register its availability and executor in the feature layer. Use that action
from UI entry points. Do not edit generated types or add an assistant-only
executor. The schema validator intentionally supports a small subset; add
validation before introducing another JSON Schema keyword.

From the repository root:

```bash
python3 scripts/app-actions/generate.py
python3 scripts/app-actions/generate.py --check
cd native-macos
swift test --filter AppActionRegistryTests
```

Executors run inside a prepared edit transaction. They must not acquire a second
edit slot or commit their own history. Return property changes and skipped IDs;
the registry handles saving, rollback, and history. Specify an existing long
operation when the feature needs the editor's cancellation controls.

The native shell includes the complete Yapper Studio navigation hierarchy.
The editor stays mounted while moving through the same destinations as the web
Studio: Home, Brain, Idea Bank, Content Library, Recorder, Editor, Poster,
Calendar, Automations, Brand, Storage, Dictionary, and Connections. Editor is
the sole platform substitution: native on Mac and web-backed in the browser.
