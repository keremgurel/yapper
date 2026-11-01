import Foundation

/// Text typed into a caption or a text layer and not saved yet.
///
/// The canvas draws it over the saved text while the creator types, and the
/// finished edit is saved once, through the action Chirpy uses, when the field
/// lets go. Nothing here touches the project, so a sentence is one Undo step
/// rather than one per pause in the typing.
@MainActor
final class TypingPreviewState: ObservableObject {
    @Published private(set) var captionText: [UUID: String] = [:]
    @Published private(set) var textLayerText: [UUID: String] = [:]

    func typeCaption(_ id: UUID, _ text: String) {
        guard captionText[id] != text else { return }
        captionText[id] = text
    }

    /// Drops a draft once its edit is in, unless more was typed meanwhile.
    func releaseCaption(_ id: UUID, ifStill text: String) {
        if captionText[id] == text { captionText[id] = nil }
    }

    func typeTextLayer(_ id: UUID, _ text: String) {
        guard textLayerText[id] != text else { return }
        textLayerText[id] = text
    }

    func releaseTextLayer(_ id: UUID, ifStill text: String) {
        if textLayerText[id] == text { textLayerText[id] = nil }
    }

    /// Undo and redo put back a whole saved project; a draft typed against
    /// the one they replaced no longer belongs on it.
    func forgetAll() {
        if !captionText.isEmpty { captionText.removeAll() }
        if !textLayerText.isEmpty { textLayerText.removeAll() }
    }
}
