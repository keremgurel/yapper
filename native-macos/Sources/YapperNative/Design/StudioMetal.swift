import SwiftUI

/// The brand's "accent metal" primitive, ported from the web design system's
/// `--sg-accent-*` tokens.
///
/// It is an aluminium button's light model in brand orange: a gradient face, a
/// gradient bezel ring around it, an inner top highlight with an inner shadow
/// under it, and a layered warm glow cast below. Every value here has a
/// counterpart token in `src/app/globals.css`; keep the two in step.
enum StudioMetal {
    /// CSS `linear-gradient(180deg, …)` is top-to-bottom.
    private static func vertical(_ stops: [(Color, Double)]) -> LinearGradient {
        LinearGradient(
            stops: stops.map { .init(color: $0.0, location: $0.1) },
            startPoint: .top,
            endPoint: .bottom
        )
    }

    /// CSS `linear-gradient(150deg, …)`: down and to the right.
    private static func diagonal150(_ stops: [(Color, Double)]) -> LinearGradient {
        LinearGradient(
            stops: stops.map { .init(color: $0.0, location: $0.1) },
            startPoint: UnitPoint(x: 0.25, y: 0.07),
            endPoint: UnitPoint(x: 0.75, y: 0.93)
        )
    }

    static func accentBezel(dark: Bool) -> LinearGradient {
        dark
            ? vertical([
                (Color(red: 1.000, green: 0.851, blue: 0.682), 0.00),
                (Color(red: 1.000, green: 0.671, blue: 0.373), 0.09),
                (Color(red: 1.000, green: 0.541, blue: 0.169), 0.32),
                (Color(red: 0.722, green: 0.329, blue: 0.075), 0.73),
                (Color(red: 1.000, green: 0.741, blue: 0.490), 1.00),
            ])
            : vertical([
                (Color(red: 1.000, green: 0.886, blue: 0.769), 0.00),
                (Color(red: 0.988, green: 0.659, blue: 0.369), 0.09),
                (Color(red: 0.961, green: 0.506, blue: 0.122), 0.32),
                (Color(red: 0.722, green: 0.282, blue: 0.039), 0.73),
                (Color(red: 1.000, green: 0.796, blue: 0.588), 1.00),
            ])
    }

    static func accentFace(dark: Bool) -> LinearGradient {
        dark
            ? diagonal150([
                (Color(red: 1.000, green: 0.627, blue: 0.290), 0.00),
                (Color(red: 1.000, green: 0.541, blue: 0.169), 0.40),
                (Color(red: 0.961, green: 0.455, blue: 0.078), 1.00),
            ])
            : diagonal150([
                (Color(red: 0.984, green: 0.545, blue: 0.208), 0.00),
                (Color(red: 0.976, green: 0.451, blue: 0.086), 0.40),
                (Color(red: 0.925, green: 0.412, blue: 0.043), 1.00),
            ])
    }

    /// The face carries white text in light mode and near-black in dark, where
    /// the face itself is brighter.
    static func accentForeground(dark: Bool) -> Color {
        dark ? Color(red: 0.102, green: 0.059, blue: 0.024) : .white
    }

    static func accentTextShadow(dark: Bool) -> (color: Color, y: CGFloat) {
        dark
            ? (Color.white.opacity(0.22), 1)
            : (Color(red: 0.47, green: 0.18, blue: 0.02).opacity(0.32), 1)
    }

    /// The cast shadow under the button, as a stack of layers applied outermost
    /// first. The final layer is the warm glow that makes it read as lit.
    static func accentDropShadow(dark: Bool, pressed: Bool) -> [(color: Color, radius: CGFloat, y: CGFloat)] {
        let cast = dark ? Color.black : Color(red: 0.486, green: 0.176, blue: 0.024)
        if pressed {
            return [
                (cast.opacity(dark ? 0.36 : 0.14), 1, 1),
                (cast.opacity(dark ? 0.24 : 0.10), 2, 2),
                (cast.opacity(dark ? 0.16 : 0.07), 3, 3),
            ]
        }
        let glow = dark
            ? Color(red: 1.0, green: 0.541, blue: 0.169).opacity(0.22)
            : Color(red: 0.976, green: 0.451, blue: 0.086).opacity(0.20)
        return [
            (cast.opacity(dark ? 0.40 : 0.16), 1, 1),
            (cast.opacity(dark ? 0.28 : 0.12), 2, 2),
            (cast.opacity(dark ? 0.20 : 0.08), 4, 4),
            (cast.opacity(dark ? 0.14 : 0.06), 8, 8),
            (glow, 12, 8),
        ]
    }

    /// `--sg-accent-inner-shadow`: a hairline highlight along the top edge, a
    /// soft shadow cast inward from it, and a faint bounce along the bottom.
    static func accentInnerShadow(dark: Bool, pressed: Bool) -> some ShapeStyle {
        let base = Color.clear
        if pressed {
            return AnyShapeStyle(
                base.shadow(
                    .inner(
                        color: Color(red: 0.275, green: 0.102, blue: 0.012)
                            .opacity(dark ? 0.32 : 0.28),
                        radius: 3,
                        x: 2,
                        y: 3
                    )
                )
            )
        }
        return AnyShapeStyle(
            base
                .shadow(.inner(color: .white.opacity(dark ? 0.40 : 0.28), radius: 0, y: 1))
                .shadow(
                    .inner(
                        color: Color(red: 0.275, green: 0.102, blue: 0.012)
                            .opacity(dark ? 0.12 : 0.10),
                        radius: 2,
                        x: 1,
                        y: 2
                    )
                )
                .shadow(.inner(color: .white.opacity(dark ? 0.16 : 0.22), radius: 1, y: -1))
        )
    }
}

/// Control metrics. The web's `h-11` default is a touch target; on a Mac the
/// same design reads at native control heights, so the proportions carry over
/// and the sizes do not.
enum StudioControlSize {
    case regular
    case small
    case mini

    var height: CGFloat {
        switch self {
        case .regular: 36
        case .small: 30
        case .mini: 24
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .regular: 14
        case .small: 10
        case .mini: 8
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .regular: 9
        case .small: 7
        case .mini: 6
        }
    }

    /// The bezel reads as a hairline at toolbar scale, exactly as the web's
    /// `[data-size="sm"]` rule drops it from 2px to 1px.
    var bezelWidth: CGFloat {
        self == .regular ? 2 : 1
    }

    var font: Font {
        switch self {
        case .regular: .system(size: 13, weight: .semibold)
        case .small: .system(size: 11.5, weight: .semibold)
        case .mini: .system(size: 11, weight: .semibold)
        }
    }
}
