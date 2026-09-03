import Foundation

/// A colour a scene names: a hex value, or a token that the asset's own
/// palette resolves. Tokens are kept as tokens in the saved scene, so a scene
/// still reads as brand-coloured after being re-rendered against a palette
/// that changed.
enum SceneColor: Codable, Equatable, Hashable, Sendable {
    case hex(StudioColor)
    case token(SceneBrandToken)

    /// Reads a hex string, a token, or the two named colours the format allows.
    init?(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let token = SceneBrandToken(rawValue: trimmed) {
            self = .token(token)
            return
        }
        switch trimmed.lowercased() {
        case "white": self = .hex(.white)
        case "black": self = .hex(.black)
        case "transparent": self = .hex(StudioColor.black.withOpacity(0))
        default:
            guard let parsed = StudioColor(hex: trimmed) else { return nil }
            self = .hex(parsed)
        }
    }

    func resolved(with palette: ScenePalette) -> StudioColor {
        switch self {
        case let .hex(color): color
        case let .token(token): palette[token]
        }
    }

    // MARK: - Codable, as the wire string

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let parsed = SceneColor(raw) else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "\(raw) is not a scene colour"
            )
        }
        self = parsed
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .hex(color): try container.encode(color.hex)
        case let .token(token): try container.encode(token.rawValue)
        }
    }
}

/// The six names a scene may use for the creator's own colours.
enum SceneBrandToken: String, Codable, CaseIterable, Sendable {
    case primary = "brand.primary"
    case secondary = "brand.secondary"
    case accent = "brand.accent"
    case ink = "brand.ink"
    case surface = "brand.surface"
    case muted = "brand.muted"
}

/// What the tokens meant when the asset was designed. Saved on the asset, not
/// looked up at draw time, so the finished video is the one that was approved.
struct ScenePalette: Codable, Equatable, Hashable, Sendable {
    var primary: StudioColor
    var secondary: StudioColor
    var accent: StudioColor
    var ink: StudioColor
    var surface: StudioColor
    var muted: StudioColor

    subscript(token: SceneBrandToken) -> StudioColor {
        switch token {
        case .primary: primary
        case .secondary: secondary
        case .accent: accent
        case .ink: ink
        case .surface: surface
        case .muted: muted
        }
    }

    /// The neutral palette a project with no brand kit designs against. The
    /// same values the web `paletteFor([])` returns.
    static let house = ScenePalette(
        primary: StudioColor(hex: "#F96F4B") ?? .brand,
        secondary: StudioColor(hex: "#1B181C") ?? .black,
        accent: StudioColor(hex: "#F96F4B") ?? .brand,
        ink: StudioColor(hex: "#1B181C") ?? .black,
        surface: .white,
        muted: StudioColor(hex: "#8A858B") ?? .black
    )
}
