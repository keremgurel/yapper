import SwiftUI

/// Whether Simple mode shows the scrubber or the full timeline under the
/// tools. Remembered, so someone who trims to the frame keeps the timeline.
enum SimpleTimelinePreference {
    static let key = "simpleShowsTimeline"

    static func usesScrubber(modeRaw: String, showsTimeline: Bool) -> Bool {
        (EditorMode(rawValue: modeRaw) ?? .simple) == .simple && !showsTimeline
    }
}

/// Folds the timeline back into the scrubber. Only in Simple, where there is
/// a scrubber to go back to; Pro always has the timeline.
struct SimpleTimelineHideButton: View {
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue
    @AppStorage(SimpleTimelinePreference.key) private var showsTimeline = false

    var body: some View {
        if (EditorMode(rawValue: modeRaw) ?? .simple) == .simple {
            Button("Hide") { showsTimeline = false }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .help("Fold the timeline back into the scrubber")
        }
    }
}
