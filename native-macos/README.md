# Yapper Studio for Mac

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

The result is `dist/Yapper Studio.app`. The native editor uses one
continuous composition for playback; it never pause/plays separate video
elements at clip boundaries.

## Install

```bash
./scripts/install-app.sh
```

This replaces `/Applications/Yapper Studio.app` with the packaged build, and
removes `/Applications/Yapper Studio Native.app`, the app's earlier name.
If the installed app is open, the script quits it the way Cmd-Q does (so a
running export can finish or cancel and clean up), swaps the bundle, and opens
the new one. The old bundle is kept in a `/Applications/.yapper-update-*`
folder only during the swap. The script removes that folder when it finishes,
and puts the old app back if the new one fails verification. Do not kill the
app or move bundles by hand: a killed export leaves its scratch folder in the
temp directory until the next launch sweeps it a day later.

## Release

A packaged build is signed ad hoc and only opens on the Mac that built it.
The download other people get comes from:

```bash
./scripts/release-app.sh
```

It builds one binary for Apple silicon and Intel, signs it with the Developer
ID certificate under the hardened runtime, has Apple notarize the app and then
the disk image, and staples both. The result is
`dist/Yapper-Studio-<version>.dmg`, with a copy at `dist/Yapper-Studio.dmg`.
It uploads nothing. It refuses to run with uncommitted changes, so every
download maps to a commit.

Each Mac that makes releases needs two things once, both done by the account
holder:

1. A Developer ID Application certificate. In Xcode, open Settings, Accounts,
   pick the team, Manage Certificates, then add "Developer ID Application".
2. Notary credentials. Make an app-specific password at account.apple.com
   (Sign-In and Security), then run the command below with the Apple ID and
   the team ID from developer.apple.com/account. It asks for the password and
   keeps it in the keychain.

```bash
xcrun notarytool store-credentials yapper-notary --apple-id APPLE_ID --team-id TEAM_ID
```

The hardened runtime blocks the camera and microphone unless the signature
asks for them, which `Resources/YapperNative.entitlements` does. A new
capability of that kind (Apple Events, for one) needs its entitlement added
there, or it fails only in the released build.

### Updates

Installed copies update themselves with [Sparkle](https://sparkle-project.org).
Once a day, and from "Check for Updates…" in the app menu, the app reads
`appcast.xml` from the latest GitHub release of keremgurel/yapper. When the
build number there is higher than its own, it offers the new version,
downloads the disk image and replaces itself. Copies of 1.0.0 have no updater,
so their owners have to download the first version that does by hand.

The release script writes `dist/appcast.xml` next to the disk image. A release
is published by attaching three files to a GitHub release tagged
`v<version>`: `Yapper-Studio-<version>.dmg`, which the appcast points at,
`Yapper-Studio.dmg`, which the site links to, and `appcast.xml`. The feed only
goes live once that release is published and marked latest, so the download
and the update notice always appear together. A release in this repository
marked latest without an `appcast.xml` makes every check fail until the next
one, so mark other releases as pre-releases.

Before each release, raise `CFBundleVersion` in `Resources/Info.plist`, as
well as `CFBundleShortVersionString`. Sparkle compares the build number, and
the script refuses one that is not higher than the published build.

Both the disk image and the feed are signed with an EdDSA key. The private
half lives in the login keychain under the account `yapper-studio`, and the
public half is `SUPublicEDKey` in `Resources/Info.plist`. Installed copies
reject any update not signed by that key, so losing it means shipping a
manual download again. Keep an exported copy somewhere safe, such as a
password manager, and import it on any other Mac that makes releases:

```bash
.build/artifacts/sparkle/Sparkle/bin/generate_keys --account yapper-studio -x yapper-sparkle-key
.build/artifacts/sparkle/Sparkle/bin/generate_keys --account yapper-studio -f yapper-sparkle-key
```

Delete the exported file afterwards. The tools appear after the first
`swift build`.

To try an update without publishing anything, make two copies of a packaged
app. In each copy's `Info.plist`, set `CFBundleVersion` lower in one than the
other, point `SUFeedURL` at `http://127.0.0.1:<port>/appcast.xml`, and add
`NSAppTransportSecurity` with `NSAllowsLocalNetworking` so plain HTTP to this
Mac is allowed. Give both a bundle ID of their own and remove
`CFBundleURLTypes`, so neither one picks up Yapper Studio's sign-in links. Then
re-sign each copy with the app signing command in `scripts/package-app.sh`.
Put the newer copy in a disk image and write its feed with
`YAPPER_DOWNLOAD_BASE=http://127.0.0.1:<port> scripts/make-appcast.sh <newer app> <newer dmg>`.
That overwrites `dist/appcast.xml`. Serve the folder with
`python3 -m http.server <port> --bind 127.0.0.1` and open the older copy.

## Temporary files

An export writes nothing outside its destination except one
`yapper-export-snapshot-<UUID>` folder in the temp directory. It holds APFS
clones of the sources and the intermediate render of a two-pass export, and it
is removed when the export finishes, fails or is cancelled. A process that dies
mid-export leaves its folder behind; at launch the app removes any such folder
older than a day, skipping folders whose `.in-use` lock another running export
still holds.

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
independent of Undo. Planning costs two credits per user turn; deterministic local
button actions are free. Deploy migration `0028_chirpy_plans` with the planning
endpoint before distributing this native build. The package script embeds the
source revision in the app's `YapperBuildCommit` Info.plist key.

To add a registered feature, define its action and input in its group file under
`protocol/actions/` (never in the generated `protocol/app-actions.schema.json`),
regenerate the Swift and TypeScript contract, then register its availability and
executor in the feature layer. Use that action from UI entry points. Do not edit
generated types or add an assistant-only executor. The schema validator
intentionally supports a small subset; add validation before introducing another
JSON Schema keyword.

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

## Audio library

Open **Audio library** from the editor toolbar, the Studio sidebar, or
Command-Shift-A. The library has its own **Back to editor** action and accepts
local audio files through **Import audio** or drag and drop.

Each imported track and bundled sound effect has a **Default volume** slider
and editable percentage (0–100%). Preferences are saved on this Mac. Previews
use these levels, including live adjustments during library playback. New
manual and assistant-created sound layers copy the current default; existing
clips, replacements, and saved projects retain their individual mix levels.
Timeline volume controls still allow amplification up to 200%.
