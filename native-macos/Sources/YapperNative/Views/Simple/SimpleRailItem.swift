import SwiftUI

/// The panes Simple mode keeps: what a creator talking to camera actually
/// does. 1-Click Edit and captions first, then a hook, a line of text or a
/// sound here and there. Everything else is in Pro, or a sentence to Chirpy
/// away.
enum SimpleRailItem: String, CaseIterable, Identifiable {
    case quick
    case captions
    case text
    case sounds

    var id: String { rawValue }

    var title: String {
        switch self {
        case .quick: "Edit"
        case .captions: "Captions"
        case .text: "Text"
        case .sounds: "Sounds"
        }
    }

    var glyph: StudioGlyphKind {
        switch self {
        case .quick: .quickEdit
        case .captions: .captions
        case .text: .text
        case .sounds: .audio
        }
    }

    var purpose: String {
        switch self {
        case .quick: "1-Click Edit, and the transcript to cut by its words"
        case .captions: "How the captions look and what they say"
        case .text: "A hook at the start, or a line of text anywhere"
        case .sounds: "Music and sound effects"
        }
    }

    /// The Pro tab an inspector request names, mapped onto the rail.
    init?(tab: WorkbenchTab) {
        switch tab {
        case .quick, .transcript: self = .quick
        case .captions: self = .captions
        case .text: self = .text
        case .audio: self = .sounds
        default: return nil
        }
    }
}
