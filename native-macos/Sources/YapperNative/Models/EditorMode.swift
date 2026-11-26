import Foundation

/// How much of the editor is on screen.
///
/// Simple is for creators talking to camera: 1-Click Edit and captions first,
/// a hook, text or a sound here and there, and Chirpy docked under the preview.
/// Pro is every control the editor has. Both run the same registered actions, so switching never loses
/// work and anything done in one can be done in the other.
enum EditorMode: String, CaseIterable, Identifiable {
    case simple
    case pro

    static let storageKey = "editorMode"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .simple: "Simple"
        case .pro: "Pro"
        }
    }

    var purpose: String {
        switch self {
        case .simple: "Simple: 1-Click Edit, captions, a hook and sounds, with Chirpy under the preview"
        case .pro: "Pro: every tab and control the editor has"
        }
    }
}
