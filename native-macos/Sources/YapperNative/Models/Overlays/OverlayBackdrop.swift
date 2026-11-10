import Foundation

/// What fills the frame behind an overlay card while it is on screen.
///
/// A card laid straight over the speaker reads as pasted on. Most cutaways in
/// a talking-head edit want the room to step back: either the speaker's own
/// picture blurred and dimmed (frosted), or a calm generated surface. Both are
/// drawn by the compositor between the speaker and the card, so captions and
/// anything in front of the card are untouched.
///
/// `nil` on an overlay means nothing is drawn behind it, which is every
/// overlay saved before this existed.
struct OverlayBackdrop: Codable, Equatable, Hashable, Sendable {
    enum Kind: String, Codable, Sendable {
        /// The speaker's own footage, blurred and slightly darkened.
        case frosted
        /// A generated surface. See `BackdropPreset`.
        case preset
        /// A picture in the project's media, filling the frame: one the
        /// creator imported, or one generated from a sentence.
        case image
    }

    var kind: Kind
    /// Which surface, when `kind` is `.preset`.
    var preset: BackdropPreset?
    /// The preset's colours as `#RRGGBB`, background first, in the order of
    /// `BackdropPreset.colorNames`. `nil` uses the preset's own.
    var colors: [String]?
    /// The picture, when `kind` is `.image`.
    var mediaID: UUID?

    /// The colours a preset is drawn with: the creator's where they set them,
    /// the preset's own everywhere else.
    var resolvedColors: [String] {
        guard let preset else { return [] }
        return preset.resolvedColors(colors)
    }

    /// The same look, whatever its colours. What a swatch compares against.
    func isSameLook(as other: OverlayBackdrop?) -> Bool {
        guard let other else { return false }
        return kind == other.kind && preset == other.preset && mediaID == other.mediaID
    }

    static let frosted = OverlayBackdrop(kind: .frosted)
    static func preset(_ preset: BackdropPreset) -> OverlayBackdrop {
        OverlayBackdrop(kind: .preset, preset: preset)
    }

    /// How long the backdrop takes to arrive once the card is up. Short enough
    /// to feel like the card bringing it, long enough not to read as a cut.
    static let fadeIn: Double = 0.35

    static func image(_ mediaID: UUID) -> OverlayBackdrop {
        OverlayBackdrop(kind: .image, mediaID: mediaID)
    }

    /// A backdrop that can be drawn. A preset or image with nothing named is
    /// not one.
    var isDrawable: Bool {
        switch kind {
        case .frosted: true
        case .preset: preset != nil
        case .image: mediaID != nil
        }
    }

    /// The token Chirpy and the action contract use: `frosted`, a preset's
    /// raw value, or `none`.
    var token: String {
        switch kind {
        case .frosted: "frosted"
        case .preset: preset?.rawValue ?? "none"
        case .image: "image"
        }
    }

    /// Reads a token back. `none` and anything unknown come back `nil`.
    init?(token: String) {
        if token == "frosted" {
            self = .frosted
        } else if let preset = BackdropPreset(rawValue: token) {
            self = .preset(preset)
        } else {
            return nil
        }
    }

    init(kind: Kind, preset: BackdropPreset? = nil, colors: [String]? = nil, mediaID: UUID? = nil) {
        self.kind = kind
        self.preset = preset
        self.colors = colors
        self.mediaID = mediaID
    }
}

/// The generated surfaces. Drawn in code from a few numbers each (see
/// `BackdropPresetRenderer`), so they cost no disk space and look the same at
/// any export size.
///
/// All of them are dark and still on purpose. White captions with a black
/// outline sit 75 to 85% down the frame and have to stay readable there, and a
/// backdrop that moves or glows pulls the eye off the product shown on the
/// card.
enum BackdropPreset: String, Codable, CaseIterable, Identifiable, Sendable {
    /// Deep navy, a tall soft glow and a brand-blue halo behind the card.
    case navyGlow
    /// Faint teal and violet bands across the top of a near-black sky.
    case aurora
    /// Soft rays falling from above the frame.
    case lightRays
    /// A dark mesh of plum, ember and navy, with heavier grain.
    case grainient
    /// A faint grid that fades out toward the edges.
    case shapeGrid

    var id: String { rawValue }

    var title: String {
        switch self {
        case .navyGlow: "Navy glow"
        case .aurora: "Aurora"
        case .lightRays: "Light rays"
        case .grainient: "Grainient"
        case .shapeGrid: "Grid"
        }
    }

    /// What each colour does, background first. The colour controls are
    /// labelled with these.
    var colorNames: [String] {
        switch self {
        case .navyGlow: ["Background", "Glow", "Halo"]
        case .aurora: ["Sky", "Upper band", "Lower band"]
        case .lightRays: ["Background", "Rays", "Light"]
        case .grainient: ["Background", "Top left", "Right", "Bottom"]
        case .shapeGrid: ["Background", "Lines", "Glow"]
        }
    }

    /// The colours the preset was tuned with.
    var defaultColors: [String] {
        switch self {
        case .navyGlow: ["#0D1B3A", "#284E92", "#5488F5"]
        case .aurora: ["#0A0F1E", "#349692", "#604EB2"]
        case .lightRays: ["#080A12", "#96B2E4", "#7896D2"]
        case .grainient: ["#0B0910", "#461A42", "#964028", "#183484"]
        case .shapeGrid: ["#0A0C12", "#96A5C8", "#283C6E"]
        }
    }

    /// `custom` laid over the defaults slot by slot, so a short or partly
    /// invalid list still gives every slot a colour.
    func resolvedColors(_ custom: [String]?) -> [String] {
        defaultColors.enumerated().map { index, fallback in
            guard let custom, custom.indices.contains(index), BackdropPreset.isHex(custom[index]) else { return fallback }
            return custom[index].uppercased()
        }
    }

    static func isHex(_ value: String) -> Bool {
        let digits = value.hasPrefix("#") ? value.dropFirst() : Substring(value)
        return digits.count == 6 && digits.allSatisfy(\.isHexDigit)
    }
}
