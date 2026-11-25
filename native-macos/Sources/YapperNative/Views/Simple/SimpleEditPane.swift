import SwiftUI

/// The edit itself, in one place: 1-Click Edit and its three quick steps on
/// top, and the transcript under them, where a creator cuts by deleting words.
/// An empty project starts with the one thing it needs, the take.
struct SimpleEditPane: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(spacing: 0) {
            if session.project.clips.isEmpty {
                addTake
                Rectangle().fill(Color.studioLine).frame(height: 1)
            }
            QuickEditWorkbench(session: session)
                .frame(height: 176)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            TranscriptWorkbench(session: session, cursor: session.playbackCursor, seekReveal: session.timelineSeekReveal)
        }
    }

    private var addTake: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Add your take").font(.studioBodyStrong)
                Text("Or drop a video on the timeline.").font(.studioCaption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                StudioGlyphLabel("Import", glyph: .plus)
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(session.isBusy)
        }
        .padding(16)
    }
}
