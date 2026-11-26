import AppKit
import SwiftUI

/// The face behind each font choice. The first three are the system font in
/// its three designs; the rest are families every Mac ships, so the preview
/// and the export draw with exactly the same glyphs and nothing is bundled or
/// downloaded.
extension TextLayerFont {
    /// The PostScript name of the installed face, or `nil` for the system font.
    var faceName: String? {
        switch self {
        case .modern, .rounded, .editorial: nil
        case .impact: "Impact"
        case .condensed: "Futura-CondensedExtraBold"
        case .geometric: "AvenirNext-Heavy"
        case .slab: "Rockwell-Bold"
        case .marker: "MarkerFelt-Wide"
        case .typewriter: "AmericanTypewriter-Bold"
        }
    }

    /// The system font's design, for the three that use it and as the
    /// fallback when a face is missing.
    var canvasDesign: Font.Design {
        switch self {
        case .rounded, .marker: .rounded
        case .editorial, .slab, .typewriter: .serif
        default: .default
        }
    }

    /// For burning into the export.
    func nsFont(size: CGFloat) -> NSFont {
        if let faceName, let face = NSFont(name: faceName, size: size) { return face }
        let base = NSFont.systemFont(ofSize: size, weight: .heavy)
        let design: NSFontDescriptor.SystemDesign = switch canvasDesign {
        case .rounded: .rounded
        case .serif: .serif
        default: .default
        }
        guard let descriptor = base.fontDescriptor.withDesign(design),
              let font = NSFont(descriptor: descriptor, size: size) else { return base }
        return font
    }

    /// For drawing on the canvas, at the same size as the export.
    func canvasFont(size: CGFloat) -> Font {
        if let faceName, NSFont(name: faceName, size: size) != nil {
            return .custom(faceName, fixedSize: size)
        }
        return .system(size: size, weight: .heavy, design: canvasDesign)
    }

    /// The face itself, small, so a picker shows what each option looks like.
    func previewFont(size: CGFloat = 11) -> Font {
        if let faceName { return .custom(faceName, fixedSize: size + 1) }
        switch self {
        case .rounded: return .system(size: size, weight: .bold, design: .rounded)
        case .editorial: return .system(size: size, weight: .semibold, design: .serif)
        default: return .system(size: size, weight: .bold)
        }
    }
}
