import Foundation

/// One preset drawn at a point. `u` runs 0 to 1 left to right and `v` 0 to 1
/// top to bottom; `focus` is the middle of the card the backdrop sits behind,
/// in the same units, so a halo can light the card rather than the frame.
///
/// The looks are the reactbits.dev and grainient.supply ones (aurora, light
/// rays, shape grid, grainient) with the volume turned down: lower contrast,
/// darker, and nothing moving. Every one keeps the band 75 to 85% down the
/// frame dark, where white outlined captions sit.
struct BackdropPresetShader: Sendable {
    let preset: BackdropPreset
    /// Width over height of the frame, so round things stay round.
    let aspect: Double
    let focus: (x: Double, y: Double)

    /// How much fine grain is added, in 0 to 1 of full scale. Enough to stop
    /// the gradients banding in an 8-bit phone export and no more.
    var grain: Double {
        switch preset {
        case .grainient: 0.055
        case .navyGlow: 0.03
        default: 0.025
        }
    }

    func color(_ u: Double, _ v: Double) -> ShadeColor {
        let shaded: ShadeColor
        switch preset {
        case .navyGlow: shaded = navyGlow(u, v)
        case .aurora: shaded = aurora(u, v)
        case .lightRays: shaded = lightRays(u, v)
        case .grainient: shaded = grainient(u, v)
        case .shapeGrid: shaded = shapeGrid(u, v)
        }
        return captionBand(shaded, v)
    }

    // MARK: - Presets

    /// The TEF promo frame: deep navy, a tall soft glow, a brand-blue halo
    /// spilling just past the card's edges, and a dark edge. Ported stop for
    /// stop from `glow-backdrop.tsx`.
    private func navyGlow(_ u: Double, _ v: Double) -> ShadeColor {
        let top = ShadeColor(hex: 0x0D1B3A)
        let middle = ShadeColor(hex: 0x0B1631)
        let bottom = ShadeColor(hex: 0x070F23)
        var c = v < 0.52 ? top.mixed(with: middle, v / 0.52) : middle.mixed(with: bottom, (v - 0.52) / 0.48)
        let fy = focus.y
        c = Shade.radial(c, u, v, cx: focus.x, cy: fy + 0.01, rx: 0.64, ry: 0.46, stops: [
            ShadeStop(0, ShadeColor(40, 78, 146), 0.95),
            ShadeStop(0.42, ShadeColor(26, 54, 108), 0.6),
            ShadeStop(1, ShadeColor(14, 30, 64), 0),
        ])
        c = Shade.radial(c, u, v, cx: focus.x, cy: fy, rx: 0.66, ry: 0.44, stops: [
            ShadeStop(0, ShadeColor(84, 136, 245), 0.5),
            ShadeStop(0.64, ShadeColor(70, 118, 235), 0.36),
            ShadeStop(1, ShadeColor(59, 103, 220), 0),
        ])
        c = Shade.radial(c, u, v, cx: 0.5, cy: 0.44, rx: 1.2, ry: 0.78, stops: [
            ShadeStop(0.52, ShadeColor(4, 9, 22), 0),
            ShadeStop(1, ShadeColor(4, 9, 22), 0.72),
        ])
        return c
    }

    /// Two slow curtains of light across the top: muted teal over a violet
    /// one, on a sky that falls to near black.
    private func aurora(_ u: Double, _ v: Double) -> ShadeColor {
        var c = ShadeColor(hex: 0x0A0F1E).mixed(with: ShadeColor(hex: 0x05070D), Shade.smoothstep(0, 0.9, v))
        let wave1 = 0.20 + 0.045 * sin(u * 5.2 + 0.6) + 0.02 * sin(u * 11.0 + 2.1)
        let wave2 = 0.30 + 0.05 * sin(u * 4.1 + 2.4) + 0.015 * sin(u * 9.0 + 0.4)
        let teal = Shade.gaussian(v, centre: wave1, width: 0.075) * (0.7 + 0.3 * sin(u * 3.1 + 1.0))
        let violet = Shade.gaussian(v, centre: wave2, width: 0.10) * (0.6 + 0.4 * sin(u * 2.3 + 3.0))
        c = c.under(ShadeColor(52, 150, 146), alpha: 0.32 * teal)
        c = c.under(ShadeColor(96, 78, 178), alpha: 0.28 * violet)
        // A faint wash where the curtains glow onto the sky below them.
        c = c.under(ShadeColor(40, 70, 120), alpha: 0.12 * Shade.gaussian(v, centre: 0.38, width: 0.22))
        return c
    }

    /// Soft rays from a light just above the frame, fading by a third of the
    /// way down.
    private func lightRays(_ u: Double, _ v: Double) -> ShadeColor {
        var c = ShadeColor(hex: 0x080A12).mixed(with: ShadeColor(hex: 0x05060A), v)
        let ox = 0.5
        let oy = -0.12
        let dx = (u - ox) * aspect
        let dy = v - oy
        let angle = atan2(dx, dy)
        let distance = (dx * dx + dy * dy).squareRoot()
        let rays = 0.55 * pow(0.5 + 0.5 * cos(angle * 13 + 0.7), 5)
            + 0.45 * pow(0.5 + 0.5 * cos(angle * 7 - 1.3), 4)
        let cone = Shade.gaussian(angle, centre: 0, width: 0.75)
        let falloff = exp(-distance * 2.1)
        c = c.under(ShadeColor(150, 178, 228), alpha: 0.30 * rays * cone * falloff)
        // The light itself, a soft pool where the rays begin.
        c = c.under(ShadeColor(120, 150, 210), alpha: 0.18 * exp(-distance * 5.5))
        return c
    }

    /// A grainy mesh of three soft blobs, warm against cool, kept dark.
    private func grainient(_ u: Double, _ v: Double) -> ShadeColor {
        var c = ShadeColor(hex: 0x0B0910)
        let x = u * aspect
        func blob(_ bx: Double, _ by: Double, _ radius: Double) -> Double {
            let dx = x - bx * aspect
            let dy = v - by
            return exp(-(dx * dx + dy * dy) / (radius * radius))
        }
        c = c.under(ShadeColor(70, 26, 66), alpha: 0.85 * blob(0.18, 0.22, 0.42))
        c = c.under(ShadeColor(150, 64, 40), alpha: 0.55 * blob(0.92, 0.36, 0.34))
        c = c.under(ShadeColor(24, 52, 132), alpha: 0.75 * blob(0.42, 0.66, 0.40))
        return c
    }

    /// A fine grid of squares that is only there in the middle, like light
    /// falling on graph paper.
    private func shapeGrid(_ u: Double, _ v: Double) -> ShadeColor {
        var c = ShadeColor(hex: 0x0A0C12)
        let cell = 0.075
        let gx = (u * aspect).truncatingRemainder(dividingBy: cell) / cell
        let gy = v.truncatingRemainder(dividingBy: cell) / cell
        let line = 0.035
        let onLine = (gx < line || gx > 1 - line || gy < line || gy > 1 - line) ? 1.0 : 0.0
        let spot = exp(-pow(Shade.ellipse(u, v, cx: focus.x, cy: focus.y, rx: 0.75, ry: 0.5), 2) * 1.6)
        c = c.under(ShadeColor(150, 165, 200), alpha: 0.10 * onLine * spot)
        c = c.under(ShadeColor(40, 60, 110), alpha: 0.35 * spot)
        return c
    }

    // MARK: - Shared

    /// Darkens the band white captions sit in, 75 to 85% down the frame, so
    /// their outline never has to fight the backdrop.
    private func captionBand(_ c: ShadeColor, _ v: Double) -> ShadeColor {
        let band = Shade.smoothstep(0.5, 0.78, v) * (1 - Shade.smoothstep(0.9, 1.0, v) * 0.3)
        return c.scaled(1 - 0.35 * band)
    }
}
