import Foundation

/// One styleable caption field, described once and reused everywhere it has to
/// exist: reading a patch, folding it into the shared style, writing it as a
/// per-caption override, dropping that override again, and clamping the value.
///
/// Without this the same sixteen fields would be spelled out five times over,
/// and adding a seventeenth would mean remembering all five.
struct TextStyleField: Sendable {
    let isSet: @Sendable (TextStylePatch) -> Bool
    let foldIntoStyle: @Sendable (TextStylePatch, inout TextStyle) -> Void
    let copyIntoOverrides: @Sendable (TextStylePatch, inout TextStylePatch) -> Void
    let clearOverride: @Sendable (inout TextStylePatch) -> Void
    let resolveOverride: @Sendable (TextStylePatch, inout TextStyle) -> Void

    private static func make<Value: Sendable>(
        _ style: WritableKeyPath<TextStyle, Value> & Sendable,
        _ patch: WritableKeyPath<TextStylePatch, Value?> & Sendable,
        clamp: @escaping @Sendable (Value) -> Value = { $0 }
    ) -> TextStyleField {
        TextStyleField(
            isSet: { $0[keyPath: patch] != nil },
            foldIntoStyle: { source, target in
                if let value = source[keyPath: patch] { target[keyPath: style] = clamp(value) }
            },
            copyIntoOverrides: { source, target in
                if let value = source[keyPath: patch] { target[keyPath: patch] = clamp(value) }
            },
            clearOverride: { $0[keyPath: patch] = nil },
            resolveOverride: { overrides, target in
                if let value = overrides[keyPath: patch] { target[keyPath: style] = value }
            }
        )
    }

    static let all: [TextStyleField] = [
        make(\.x, \.x, clamp: TextStyle.clampPosition),
        make(\.y, \.y, clamp: TextStyle.clampPosition),
        make(\.width, \.width, clamp: TextStyle.clampWidth),
        make(\.appearance.font, \.font),
        make(\.appearance.fontScale, \.fontScale, clamp: TextStyle.clampFontScale),
        make(\.appearance.textCase, \.textCase),
        make(\.appearance.color, \.color),
        make(\.appearance.strokeEnabled, \.strokeEnabled),
        make(\.appearance.strokeColor, \.strokeColor),
        make(\.appearance.strokeWidth, \.strokeWidth, clamp: { TextAppearance.clamp($0, to: TextAppearance.strokeWidthRange) }),
        make(\.appearance.backgroundEnabled, \.backgroundEnabled),
        make(\.appearance.backgroundColor, \.backgroundColor),
        make(\.appearance.cornerRadius, \.cornerRadius, clamp: { TextAppearance.clamp($0, to: TextAppearance.cornerRadiusRange) }),
        make(\.appearance.shadowEnabled, \.shadowEnabled),
        make(\.appearance.shadowColor, \.shadowColor),
        make(\.appearance.shadowRadius, \.shadowRadius, clamp: { TextAppearance.clamp($0, to: TextAppearance.shadowRadiusRange) }),
    ]
}

extension TextStyle {
    /// Folds a patch into the shared style.
    mutating func apply(_ patch: TextStylePatch) {
        for field in TextStyleField.all {
            field.foldIntoStyle(patch, &self)
        }
    }

    /// The style with a card's overrides laid over it.
    func resolving(_ overrides: TextStylePatch) -> TextStyle {
        var result = self
        for field in TextStyleField.all {
            field.resolveOverride(overrides, &result)
        }
        return result
    }
}

extension TextStylePatch {
    /// Writes the patch onto these overrides, leaving untouched fields alone.
    mutating func merge(_ patch: TextStylePatch) {
        for field in TextStyleField.all {
            field.copyIntoOverrides(patch, &self)
        }
    }

    /// Drops the overrides for exactly the fields the patch carries. Used when
    /// the change went to the shared style instead: a stale override would keep
    /// shadowing the new shared value forever.
    mutating func clearFields(in patch: TextStylePatch) {
        for field in TextStyleField.all where field.isSet(patch) {
            field.clearOverride(&self)
        }
    }
}
