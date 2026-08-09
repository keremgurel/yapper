import Foundation
import Testing

@testable import YapperNative

@Suite struct StudioColorTests {
    @Test func hexParsesInEveryShorthand() {
        #expect(StudioColor(hex: "#FFF") == .white)
        #expect(StudioColor(hex: "000000") == .black)
        #expect(StudioColor(hex: "#00000080")?.opacity == 128.0 / 255)
        #expect(StudioColor(hex: "nope") == nil)
    }

    @Test func hexRoundTripsExactly() throws {
        let colors: [StudioColor] = [.white, .black, .brand, StudioColor.black.withOpacity(0.5)]
        for color in colors {
            let encoded = try JSONEncoder().encode(color)
            let restored = try JSONDecoder().decode(StudioColor.self, from: encoded)
            #expect(restored == color, "\(color.hex) did not survive the round trip")
        }
    }

    /// Colours are 8-bit quantities, so a value that cannot be written in hex is
    /// snapped on the way in rather than drifting on the way back out.
    @Test func channelsSnapToTheEightBitGrid() {
        let color = StudioColor(red: 1, green: 1, blue: 1, opacity: 0.86)
        #expect(color.opacity == 219.0 / 255)
        #expect(StudioColor(hex: color.hex) == color)
    }

    @Test func opaqueColorsDropTheAlphaDigits() {
        #expect(StudioColor.white.hex == "#FFFFFF")
        #expect(StudioColor.white.withOpacity(0.5).hex.count == 9)
    }
}

@Suite struct TextTemplateTests {
    @Test func aTemplateKeepsSizeAndCasing() {
        let base = TextAppearance(fontScale: 0.09, textCase: .upper)
        let outline = TextTemplate.all.first { $0.id == "outline" }!

        let applied = outline.applied(to: base)

        #expect(applied.fontScale == 0.09)
        #expect(applied.textCase == .upper)
        #expect(applied.strokeEnabled)
        #expect(outline.matches(applied))
    }

    @Test func exactlyOneTemplateMatchesTheShippedDefault() {
        let matching = TextTemplate.all.filter { $0.matches(.captionDefault) }
        #expect(matching.map(\.id) == ["clean"])
    }
}

@Suite struct TextAppearanceMigrationTests {
    /// A project saved before colour, stroke and shadow were properties stored a
    /// three-way enum. It has to open looking exactly the way it was left.
    @Test func legacyTextLayersKeepTheirLook() throws {
        let saved = """
        {
          "id": "8B2E4D0E-2C6E-4D5E-9E37-9D4F1E86F6A1",
          "text": "Old hook",
          "timelineStart": 1,
          "duration": 3,
          "x": 0.5,
          "y": 0.18,
          "width": 0.74,
          "fontScale": 0.05,
          "style": "blackCard",
          "font": "rounded"
        }
        """
        let layer = try JSONDecoder().decode(ProjectTextLayer.self, from: Data(saved.utf8))

        #expect(layer.appearance.font == .rounded)
        #expect(layer.appearance.fontScale == 0.05)
        #expect(layer.appearance.color == .white)
        #expect(layer.appearance.backgroundEnabled)
        #expect(layer.appearance.backgroundColor.withOpacity(1) == .black)
        #expect(layer.appearance.shadowEnabled == false)
    }

    @Test func legacyTextStylesKeepTheirLook() throws {
        let saved = """
        {
          "x": 0.5,
          "y": 0.82,
          "width": 0.88,
          "font": "editorial",
          "fontScale": 0.03,
          "textCase": "upper",
          "background": "whiteCard"
        }
        """
        let style = try JSONDecoder().decode(TextStyle.self, from: Data(saved.utf8))

        #expect(style.font == .editorial)
        #expect(style.fontScale == 0.03)
        #expect(style.textCase == .upper)
        #expect(style.appearance.color == .black)
        #expect(style.appearance.backgroundEnabled)
    }

    /// A caption saved before the appearance model carried its overrides flat.
    @Test func legacyCaptionOverridesBecomeAPatch() throws {
        let saved = """
        {
          "id": "0B2E4D0E-2C6E-4D5E-9E37-9D4F1E86F6A2",
          "mediaID": "1B2E4D0E-2C6E-4D5E-9E37-9D4F1E86F6A3",
          "text": "Restyled",
          "sourceStart": 1,
          "sourceEnd": 2,
          "fontScale": 0.09,
          "background": "plain"
        }
        """
        let caption = try JSONDecoder().decode(ProjectCaption.self, from: Data(saved.utf8))

        #expect(caption.overrides.fontScale == 0.09)
        #expect(caption.overrides.backgroundEnabled == false)
        #expect(caption.overrides.shadowEnabled == true)
        // Untouched fields still follow the project style.
        #expect(caption.overrides.font == nil)
    }

    @Test func aPatchClampsWhatItWrites() {
        var style = TextStyle.default
        style.apply(TextStylePatch(x: 4, width: 12, fontScale: 9, strokeWidth: 3))

        #expect(style.x == 0.95)
        #expect(style.width == TextStyle.maximumWidth)
        #expect(style.fontScale == TextAppearance.fontScaleLimits.upperBound)
        #expect(style.appearance.strokeWidth == TextAppearance.strokeWidthRange.upperBound)
    }
}
