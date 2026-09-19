import SwiftUI

struct ExtractAudioMenuItem: View {
    let session: EditorSession
    let item: TimelineSelectionItem

    var body: some View {
        Button {
            Task { await session.extractAudio(from: item) }
        } label: {
            Label("Extract audio", systemImage: "waveform")
        }
        .disabled(session.activeOperation != nil || !session.project.canExtractAudio(from: item))
        Divider()
    }
}
