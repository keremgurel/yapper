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
