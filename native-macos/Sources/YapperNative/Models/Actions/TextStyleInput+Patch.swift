import Foundation

/// The wire form of a style change and the app's own patch are the same
/// seventeen fields. Colours travel as hex strings and are checked here, so a
/// malformed colour is rejected before anything is mutated.
extension TextStylePatch {
    init(_ input: TextStyleInput) throws {
        func color(_ hex: String?, _ field: String) throws -> StudioColor? {
            guard let hex else { return nil }
            guard let parsed = StudioColor(hex: hex) else {
                throw AppActionError("\(field) must be a hex colour such as #FF7A21.")
            }
            return parsed
        }
        self.init(
            x: input.x,
            y: input.y,
            width: input.width,
            rotation: input.rotation,
            font: input.font.flatMap { TextLayerFont(rawValue: $0.rawValue) },
            fontScale: input.fontScale,
            textCase: input.textCase.flatMap { TextCasing(rawValue: $0.rawValue) },
            color: try color(input.color, "color"),
            strokeEnabled: input.strokeEnabled,
            strokeColor: try color(input.strokeColor, "strokeColor"),
            strokeWidth: input.strokeWidth,
            backgroundEnabled: input.backgroundEnabled,
            backgroundColor: try color(input.backgroundColor, "backgroundColor"),
            cornerRadius: input.cornerRadius,
            shadowEnabled: input.shadowEnabled,
            shadowColor: try color(input.shadowColor, "shadowColor"),
            shadowRadius: input.shadowRadius
        )
    }
}

extension TextStyleInput {
    /// The inspector builds patches; this is how it hands one to the action.
    init(_ patch: TextStylePatch) {
        self.init(
            x: patch.x,
            y: patch.y,
            width: patch.width,
            rotation: patch.rotation,
            font: patch.font.flatMap { TextFontChoice(rawValue: $0.rawValue) },
            fontScale: patch.fontScale,
            textCase: patch.textCase.flatMap { TextCaseChoice(rawValue: $0.rawValue) },
            color: patch.color?.hex,
            strokeEnabled: patch.strokeEnabled,
            strokeColor: patch.strokeColor?.hex,
            strokeWidth: patch.strokeWidth,
            backgroundEnabled: patch.backgroundEnabled,
            backgroundColor: patch.backgroundColor?.hex,
            cornerRadius: patch.cornerRadius,
            shadowEnabled: patch.shadowEnabled,
            shadowColor: patch.shadowColor?.hex,
            shadowRadius: patch.shadowRadius
        )
    }
}
