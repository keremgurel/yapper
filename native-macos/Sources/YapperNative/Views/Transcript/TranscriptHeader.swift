import SwiftUI

/// The top of the transcript pane: how many words there are, how to edit with
/// them, and the two things done to the transcript as a whole.
struct TranscriptHeader: View {
    @ObservedObject var session: EditorSession
    let wordCount: Int

    private var hasWords: Bool { wordCount > 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            WorkbenchPaneHeader(
                title: "Transcript",
                detail: hasWords ? "\(wordCount) words" : "Cut your take by deleting words"
            ) {
                HStack(spacing: 6) {
                    if hasWords { copyMenu }
                    transcribeButton
                }
                .fixedSize()
            }

            if hasWords {
                Text("Click a word to jump to it. Drag across words to select them, then delete or restore. Click a pause like […1.2s] to cut it.")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var copyMenu: some View {
        Menu("Copy") {
            Button("Everything that was said") { session.copyTranscript(keptOnly: false) }
            Button("Only the words kept in the edit") { session.copyTranscript(keptOnly: true) }
        }
        .menuStyle(.borderlessButton)
        .font(.studioLabelStrong)
        .fixedSize()
        .help("Copy the transcript as text")
    }

    private var transcribeButton: some View {
        Button {
            session.startTranscription()
        } label: {
            StudioGlyphLabel(hasWords ? "Transcribe again" : "Transcribe", glyph: .transcript, size: 13)
        }
        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        .disabled(session.isBusy || session.project.clips.isEmpty)
        .help(hasWords
            ? "Listen to the timeline again and replace this transcript"
            : "Turn what is said on the timeline into words you can edit")
    }
}
