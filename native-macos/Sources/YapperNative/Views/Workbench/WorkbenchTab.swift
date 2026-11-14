import SwiftUI

/// The editor's tool panes, in their default order.
enum WorkbenchTab: String, CaseIterable, Identifiable {
    case media = "Media"
    case quick = "Quick Edit"
    case transcript = "Transcript"
    /// The speaker's own picture: how it sits in the frame, and how it moves.
    case video = "Video"
    case audio = "Audio"
    case text = "Text"
    case overlays = "Overlays"
    case captions = "Captions"
    case filters = "Filters"

    var id: String { rawValue }

    var glyph: StudioGlyphKind {
        switch self {
        case .media: .media
        case .quick: .quickEdit
        case .transcript: .transcript
        case .video: .video
        case .audio: .audio
        case .text: .text
        case .overlays: .overlays
        case .captions: .captions
        case .filters: .filters
        }
    }

    /// What the pane is for, in a sentence. The tab's tooltip.
    var purpose: String {
        switch self {
        case .media: "Everything imported into this project"
        case .quick: "One-click edits: remove pauses and retakes, add captions"
        case .transcript: "Edit the video by editing its words"
        case .video: "Speed, framing and background for the clip under the playhead"
        case .audio: "Music and sound effects on the timeline"
        case .text: "Titles and hooks placed over the video"
        case .overlays: "Pictures and clips shown over the speaker"
        case .captions: "How the captions look and what they say"
        case .filters: "Colour looks for the whole video"
        }
    }

    /// Width of the tab in the strip. Quick Edit is two words.
    var stripWidth: CGFloat { self == .quick ? 78 : 64 }
}
