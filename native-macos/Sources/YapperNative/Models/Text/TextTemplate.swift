import Foundation

/// A named look: the bundle of colour, stroke, card and shadow choices that
/// makes captions read as one style. A template is a starting point, not a mode
/// — every field it writes stays editable underneath in the property sections.
///
/// Size and casing are deliberately not part of a template. Those are decisions
/// about the cut (how much fits on screen, how shouty it reads), so picking a
/// new look never resets them.
struct TextTemplate: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    /// The look itself. Its `fontScale` and `textCase` exist only so the preview
    /// tile has something to draw with.
    let appearance: TextAppearance

    /// The look written onto an existing appearance, keeping the size and casing
    /// already set.
    func applied(to base: TextAppearance) -> TextAppearance {
        var result = appearance
        result.fontScale = base.fontScale
        result.textCase = base.textCase
        return result
    }

    /// True when the text already looks like this template, so the gallery can
    /// show which one is live.
    func matches(_ base: TextAppearance) -> Bool {
        applied(to: base) == base
    }
}

extension TextTemplate {
    static let all: [TextTemplate] = [
        TextTemplate(
            id: "clean",
            name: "Clean",
            appearance: TextAppearance(
                color: .white,
                shadowEnabled: true,
                shadowColor: StudioColor.black.withOpacity(0.85),
                shadowRadius: 0.3
            )
        ),
        TextTemplate(
            id: "outline",
            name: "Outline",
            appearance: TextAppearance(
                color: .white,
                strokeEnabled: true,
                strokeColor: .black,
                strokeWidth: 0.09,
                shadowEnabled: false
            )
        ),
        TextTemplate(
            id: "pop",
            name: "Pop",
            appearance: TextAppearance(
                color: StudioColor(hex: "#FFD93D") ?? .white,
                strokeEnabled: true,
                strokeColor: .black,
                strokeWidth: 0.11,
                shadowEnabled: false
            )
        ),
        TextTemplate(
            id: "brand",
            name: "Brand",
            appearance: TextAppearance(
                font: .rounded,
                color: .white,
                strokeEnabled: false,
                backgroundEnabled: true,
                backgroundColor: StudioColor.brand.withOpacity(0.94),
                cornerRadius: 0.45,
                shadowEnabled: false
            )
        ),
        TextTemplate(
            id: "contrast",
            name: "Contrast",
            appearance: TextAppearance(
                color: .white,
                backgroundEnabled: true,
                backgroundColor: StudioColor.black.withOpacity(0.86),
                cornerRadius: 0.3,
                shadowEnabled: false
            )
        ),
        TextTemplate(
            id: "paper",
            name: "Paper",
            appearance: TextAppearance(
                font: .editorial,
                color: .black,
                backgroundEnabled: true,
                backgroundColor: StudioColor.white.withOpacity(0.96),
                cornerRadius: 0.22,
                shadowEnabled: false
            )
        ),
    ]

    /// The template the text currently matches, if any.
    static func active(for appearance: TextAppearance) -> TextTemplate? {
        all.first { $0.matches(appearance) }
    }
}
