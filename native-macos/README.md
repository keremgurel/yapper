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

The native shell includes the complete Yapper Studio navigation hierarchy.
The editor stays mounted while moving through Home, Idea Bank, Content Library,
Recorder, Poster, Calendar, Automations, Brand, Dictionary, and Connections, so
the open media, cuts, playhead, and panel layout are retained.
