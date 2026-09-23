import Foundation

/// Where a piece is in the pipeline. Tones match the web's `statusTone`.
enum IdeaCanvasStatus: String, CaseIterable, Identifiable {
    case captured, drafting, ready, posted
    var id: String { rawValue }

    var label: String {
        switch self {
        case .captured: "Captured"
        case .drafting: "Drafting"
        case .ready: "Ready"
        case .posted: "Posted"
        }
    }

    var tone: NativeChip.Tone {
        switch self {
        case .captured: .neutral
        case .drafting: .cyan
        case .ready: .yellow
        case .posted: .green
        }
    }
}

/// What a piece ships as. Same ids, labels and order as `CONTENT_FORMATS`.
struct IdeaCanvasFormat: Identifiable, Equatable {
    let id: String
    let label: String
    let tone: NativeChip.Tone

    static let all: [IdeaCanvasFormat] = [
        IdeaCanvasFormat(id: "short", label: "Short-form", tone: .cyan),
        IdeaCanvasFormat(id: "long", label: "Long-form", tone: .violet),
        IdeaCanvasFormat(id: "article", label: "Article", tone: .red),
        IdeaCanvasFormat(id: "thread", label: "Thread", tone: .yellow),
        IdeaCanvasFormat(id: "carousel", label: "Carousel", tone: .green),
        IdeaCanvasFormat(id: "newsletter", label: "Newsletter", tone: .neutral),
    ]

    /// Toggles one format, keeping library order so two items with the same
    /// formats always read the same way round.
    static func toggle(_ id: String, in formats: [String]) -> [String] {
        if formats.contains(id) { return formats.filter { $0 != id } }
        return all.filter { $0.id == id || formats.contains($0.id) }.map(\.id)
    }
}
