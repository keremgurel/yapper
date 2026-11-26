import SwiftUI

/// The edit itself: 1-Click Edit on top, and the transcript under it with
/// every point of height left, because cutting by words is the edit. Captions,
/// text and sounds have their own tabs on the rail, which tick off as each is
/// done. An empty project starts with the one thing it needs, the take.
struct SimpleEditPane: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if session.project.clips.isEmpty {
                    addTake
                } else {
                    OneClickEditCard(session: session)
                }
            }
            .padding(14)
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
    }
}
