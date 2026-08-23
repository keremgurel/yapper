import SwiftUI

/// What the property sections need in order to edit a run of text: its current
/// values, what resetting them means, and one way to change them.
///
/// Captions and text layers both hand one of these to the same sections, which
/// is what lets the two inspectors look and behave identically while the edits
/// underneath go somewhere very different — a shared style with per-card
/// overrides on one side, a single layer on the other.
struct TextStyleEditor {
    var style: TextStyle
    /// What the reset control in each section header restores. Captions and
    /// text layers ship with different looks, so each hands over its own.
    var defaults: TextStyle
    /// Text layers are set larger than captions, so the size slider needs
    /// different headroom for each.
    var fontScaleRange: ClosedRange<Double> = TextAppearance.fontScaleRange
    /// `live` is true while a control streams — a slider drag, a colour being
    /// scrubbed — so the whole gesture can land as one undo step.
    var apply: (TextStylePatch, Bool) -> Void

    var appearance: TextAppearance { style.appearance }
    var defaultAppearance: TextAppearance { defaults.appearance }
    var x: Double { style.x }
    var y: Double { style.y }
    var width: Double { style.width }
    var rotation: Double { style.rotation }

    func set(_ patch: TextStylePatch, live: Bool = false) {
        apply(patch, live)
    }

    /// A switch that writes straight through, for the on/off in a section header.
    func flag(
        _ value: Bool,
        _ keyPath: WritableKeyPath<TextStylePatch, Bool?>
    ) -> Binding<Bool> {
        Binding(
            get: { value },
            set: { newValue in
                var patch = TextStylePatch()
                patch[keyPath: keyPath] = newValue
                set(patch)
            }
        )
    }

    /// The size the creator sees: a whole number, a thousandth of stage height
    /// each, rather than a fraction with three leading zeroes.
    var displaySize: Double { (appearance.fontScale * 1000).rounded() }
    var displaySizeRange: ClosedRange<Double> {
        (fontScaleRange.lowerBound * 1000) ... (fontScaleRange.upperBound * 1000)
    }
}
