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
    }

    var kind: Kind
    /// Which surface, when `kind` is `.preset`.
    var preset: BackdropPreset?

    static let frosted = OverlayBackdrop(kind: .frosted)
    static func preset(_ preset: BackdropPreset) -> OverlayBackdrop {
        OverlayBackdrop(kind: .preset, preset: preset)
    }

    /// How long the backdrop takes to arrive once the card is up. Short enough
    /// to feel like the card bringing it, long enough not to read as a cut.
    static let fadeIn: Double = 0.35

    /// A backdrop that can be drawn. A preset with no preset named is not one.
    var isDrawable: Bool { kind == .frosted || preset != nil }

    /// The token Chirpy and the action contract use: `frosted`, a preset's
    /// raw value, or `none`.
    var token: String {
        switch kind {
        case .frosted: "frosted"
        case .preset: preset?.rawValue ?? "none"
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

    init(kind: Kind, preset: BackdropPreset? = nil) {
        self.kind = kind
        self.preset = preset
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
}
