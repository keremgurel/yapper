import SwiftUI

/// Where an idea sits in the pipeline, in pipeline order.
enum IdeaStatus: String, CaseIterable, Identifiable {
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

    /// Neutral for a raw capture, cyan while drafting, yellow while waiting,
    /// green once it shipped. Same hues as the web chips.
    var tone: NativeChip.Tone {
        switch self {
        case .captured: .neutral
        case .drafting: .cyan
        case .ready: .yellow
        case .posted: .green
        }
    }

    var rank: Int { Self.allCases.firstIndex(of: self) ?? 0 }
}

/// What kind of idea it is, derived from what was captured.
enum IdeaKind: String {
    case original
    case semiOriginal = "semi-original"
    case inspiration

    var label: String {
        switch self {
        case .original: "Original"
        case .semiOriginal: "Semi-original"
        case .inspiration: "Inspiration"
        }
    }
}

/// Whether we have the reference's actual words, in one word.
enum IdeaReferenceState {
    static func label(_ status: String?) -> (text: String, caution: Bool)? {
        switch status {
        case "ready": ("Transcript", false)
        case "pending": ("Fetching", false)
        case "needs_media": ("No transcript", true)
        case "unavailable": ("Summary only", true)
        default: nil
        }
    }
}

/// What a piece is going to be published as.
struct IdeaFormat: Identifiable {
    let id: String
    let label: String
    let tone: NativeChip.Tone

    static let all: [IdeaFormat] = [
        IdeaFormat(id: "short", label: "Short-form", tone: .cyan),
        IdeaFormat(id: "long", label: "Long-form", tone: .violet),
        IdeaFormat(id: "article", label: "Article", tone: .blue),
        IdeaFormat(id: "thread", label: "Thread", tone: .yellow),
        IdeaFormat(id: "carousel", label: "Carousel", tone: .green),
        IdeaFormat(id: "newsletter", label: "Newsletter", tone: .neutral),
    ]

    static func find(_ id: String) -> IdeaFormat? { all.first { $0.id == id } }
}

enum IdeaPillarTone {
    private static let tones: [NativeChip.Tone] = [.cyan, .violet, .green, .blue, .yellow]

    /// Pillars store no colour, so one is hashed from the name, the same way
    /// the web does it, so a pillar keeps its hue on every surface.
    static func tone(for name: String) -> NativeChip.Tone {
        var hash: UInt32 = 0
        for unit in name.utf16 {
            hash = hash &* 31 &+ UInt32(unit)
        }
        return tones[Int(hash % UInt32(tones.count))]
    }
}
