import SwiftUI

/// The edit itself, in one place: 1-Click Edit and its three quick steps on
/// top, and the transcript under them, where a creator cuts by deleting words.
struct SimpleEditPane: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(spacing: 0) {
            QuickEditWorkbench(session: session)
                .frame(height: 176)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            TranscriptWorkbench(session: session, cursor: session.playbackCursor, seekReveal: session.timelineSeekReveal)
        }
    }
}
