import Foundation

enum IdeaCanvasBlockKind: String, CaseIterable, Identifiable {
    case paragraph, script, bullets, steps
    var id: String { rawValue }

    /// Whether the block stores a list of items rather than prose.
    var isList: Bool { self == .bullets || self == .steps }

    var label: String {
        switch self {
        case .paragraph: "Text"
        case .script: "Script"
        case .bullets: "Bullets"
        case .steps: "Steps"
        }
    }
}

/// One block on the canvas. `id` is client-side identity, stable across
/// reorders, and never persisted.
struct IdeaCanvasBlock: Identifiable, Equatable {
    let id: String
    var label: String
    var kind: IdeaCanvasBlockKind
    var text: String
    var items: [String]

    init(id: String = UUID().uuidString, label: String = "", kind: IdeaCanvasBlockKind = .paragraph,
         text: String = "", items: [String] = []) {
        self.id = id
        self.label = label.trimmingCharacters(in: .whitespacesAndNewlines)
        self.kind = kind
        self.text = text
        self.items = items.map { item in String(item.drop(while: { $0.isWhitespace })) }
    }

    init(stored: IdeaCanvasStoredBlock) {
        self.init(
            label: stored.label,
            kind: IdeaCanvasBlockKind(rawValue: stored.kind) ?? .paragraph,
            text: stored.text ?? "",
            items: stored.items ?? []
        )
    }

    init(input: IdeaCanvasBlockInput) {
        self.init(label: input.label, kind: input.kind, text: input.text ?? "", items: input.items ?? [])
    }

    /// The words in the block, for a prompt or a check for emptiness.
    var plainText: String { kind.isList ? items.joined(separator: "\n") : text }
}
