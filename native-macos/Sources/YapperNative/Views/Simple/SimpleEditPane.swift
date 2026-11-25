import SwiftUI

/// The edit itself: the steps in one row, and the transcript under them with
/// every point of height left, because cutting by words is the edit. Chirpy
/// is the bird, the same as on every other pane. An empty project starts with
/// the one thing it needs, the take.
struct SimpleEditPane: View {
    @ObservedObject var session: EditorSession
    let open: (SimpleRailItem) -> Void

    var body: some View {
        VStack(spacing: 0) {
            if session.project.clips.isEmpty {
                addTake
            } else {
                SimpleEditSteps(session: session, open: open)
            }
            Rectangle().fill(Color.studioLine).frame(height: 1)
            TranscriptWorkbench(session: session, cursor: session.playbackCursor, seekReveal: session.timelineSeekReveal)
        }
    }

    private var addTake: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Add your take").font(.studioBodyStrong)
                Text("The video you recorded, to cut by its words.").font(.studioCaption).foregroundStyle(.secondary)
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
