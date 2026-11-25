import SwiftUI

/// The tools with the timeline or the scrubber under them, for the tall
/// preview layout, where this column sits beside a full-height preview.
///
/// Watches the mode and the timeline choice itself: the split view beside it
/// hosts this once, so only a view that observes them redraws when they change.
struct EditorWorkColumn: View {
    @ObservedObject var session: EditorSession
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue
    @AppStorage(SimpleTimelinePreference.key) private var showsTimeline = false

    var body: some View {
        if SimpleTimelinePreference.usesScrubber(modeRaw: modeRaw, showsTimeline: showsTimeline) {
            VStack(spacing: 0) {
                EditorWorkbench(session: session)
                Rectangle().fill(Color.studioLine).frame(height: 1)
                SimpleScrubber(session: session) { showsTimeline = true }
            }
        } else {
            NativeSplitPanes(
                isVertical: false,
                minimumFirst: 320,
                minimumSecond: 230,
                defaultFraction: 0.65,
                defaultsKey: "editorTallWorkbenchTimelineFraction"
            ) {
                EditorWorkbench(session: session)
            } second: {
                TimelinePanel(session: session)
            }
        }
    }
}

/// The standard layout's version: the tools and preview side by side, with
/// the timeline or the scrubber across the full width under both.
struct EditorStandardLayout<Workspace: View>: View {
    @ObservedObject var session: EditorSession
    @ViewBuilder let workspace: Workspace
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue
    @AppStorage(SimpleTimelinePreference.key) private var showsTimeline = false

    var body: some View {
        if SimpleTimelinePreference.usesScrubber(modeRaw: modeRaw, showsTimeline: showsTimeline) {
            VStack(spacing: 0) {
                workspace
                Rectangle().fill(Color.studioLine).frame(height: 1)
                SimpleScrubber(session: session) { showsTimeline = true }
            }
        } else {
            NativeSplitPanes(
                isVertical: false,
                minimumFirst: 390,
                minimumSecond: 230,
                defaultFraction: 0.65,
                defaultsKey: "editorStandardWorkspaceTimelineFraction"
            ) {
                workspace
            } second: {
                TimelinePanel(session: session)
            }
        }
    }
}
