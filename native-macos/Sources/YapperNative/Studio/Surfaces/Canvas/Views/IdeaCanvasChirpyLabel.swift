import SwiftUI

/// Any action that asks Chirpy: its words, with the sparkle in brand orange
/// so every AI action on the canvas reads as one kind of thing.
struct IdeaCanvasChirpyLabel: View {
    let title: String

    init(_ title: String) { self.title = title }

    var body: some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: "sparkles").foregroundStyle(Color.yapperOrange)
        }
    }
}
