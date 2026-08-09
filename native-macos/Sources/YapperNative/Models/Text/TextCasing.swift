import SwiftUI

/// Display-only casing. Applying it at render time rather than rewriting the
/// string means switching back to `.asSpoken` always restores exactly what was
/// typed, or exactly what the transcriber heard.
enum TextCasing: String, Codable, CaseIterable, Identifiable, Sendable {
    /// Deliberately not named `none`: as an optional's member that spelling
    /// collides with `Optional.none`, so `TextStylePatch(textCase: .none)`
    /// would silently mean "no change" instead of "revert the casing".
    case asSpoken
    case lower
    case upper

    var id: String { rawValue }

    var title: String {
        switch self {
        case .asSpoken: "As typed"
        case .lower: "lowercase"
        case .upper: "UPPERCASE"
        }
    }

    func apply(to text: String) -> String {
        switch self {
        case .asSpoken: text
        case .lower: text.lowercased()
        case .upper: text.uppercased()
        }
    }
}

extension TextCasing {
    /// The three casings, as a segmented control offers them. Shared so the
    /// captions panel and the text panel cannot drift into different labels for
    /// the same three things.
    static var inspectorOptions: [InspectorSegmentedControl<TextCasing>.Option] {
        [
            // "Original" rather than "Aa": the other two show what they do to
            // the letters, and this one does nothing to them, which a sample
            // of letters cannot say.
            .init(value: .asSpoken, label: "Original"),
            .init(value: .lower, label: "aa"),
            .init(value: .upper, label: "AA"),
        ]
    }
}
