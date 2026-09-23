import Foundation

/// The ask field: whether it is showing, what is typed, and which block the
/// next ask is aimed at.
@MainActor
final class IdeaCanvasAskBarState: ObservableObject {
    @Published var isOpen = false
    @Published var draft = ""
    /// The block the next ask changes, by client id. Nil asks about the piece.
    @Published var targetID: String?
    /// Bumped to put the cursor in the field.
    @Published private(set) var focusRequest = 0

    func open(prefill: String? = nil) {
        if let prefill { draft = prefill }
        isOpen = true
        focusRequest += 1
    }

    func aim(at block: IdeaCanvasBlock) {
        targetID = block.id
        let name = block.label.trimmingCharacters(in: .whitespacesAndNewlines)
        open(prefill: "Change the \(name.isEmpty ? "part" : name): ")
    }

    func close() {
        isOpen = false
        targetID = nil
    }
}
