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
    /// The preset's colours, background first, resolved against its defaults.
    let palette: [ShadeColor]

    init(preset: BackdropPreset, aspect: Double, focus: (x: Double, y: Double), colors: [String]? = nil) {
        self.preset = preset
        self.aspect = aspect
        self.focus = focus
        palette = preset.resolvedColors(colors).map(ShadeColor.init(hexString:))
    }

    private func slot(_ index: Int) -> ShadeColor {
        palette.indices.contains(index) ? palette[index] : ShadeColor(0, 0, 0)
    }

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
        let base = slot(0)
        let glow = slot(1)
        let halo = slot(2)
        let top = base
        let middle = base.scaled(0.86)
        let bottom = base.scaled(0.56)
        var c = v < 0.52 ? top.mixed(with: middle, v / 0.52) : middle.mixed(with: bottom, (v - 0.52) / 0.48)
        let fy = focus.y
        c = Shade.radial(c, u, v, cx: focus.x, cy: fy + 0.01, rx: 0.64, ry: 0.46, stops: [
            ShadeStop(0, glow, 0.95),
            ShadeStop(0.42, glow.scaled(0.68), 0.6),
            ShadeStop(1, glow.scaled(0.36), 0),
        ])
        c = Shade.radial(c, u, v, cx: focus.x, cy: fy, rx: 0.66, ry: 0.44, stops: [
            ShadeStop(0, halo, 0.5),
            ShadeStop(0.64, halo.scaled(0.9), 0.36),
            ShadeStop(1, halo.scaled(0.85), 0),
        ])
        c = Shade.radial(c, u, v, cx: 0.5, cy: 0.44, rx: 1.2, ry: 0.78, stops: [
            ShadeStop(0.52, base.scaled(0.32), 0),
            ShadeStop(1, base.scaled(0.32), 0.72),
        ])
        return c
    }

    /// Two slow curtains of light across the top: muted teal over a violet
    /// one, on a sky that falls to near black.
    private func aurora(_ u: Double, _ v: Double) -> ShadeColor {
        var c = slot(0).mixed(with: slot(0).scaled(0.48), Shade.smoothstep(0, 0.9, v))
        let wave1 = 0.20 + 0.045 * sin(u * 5.2 + 0.6) + 0.02 * sin(u * 11.0 + 2.1)
        let wave2 = 0.30 + 0.05 * sin(u * 4.1 + 2.4) + 0.015 * sin(u * 9.0 + 0.4)
        let teal = Shade.gaussian(v, centre: wave1, width: 0.075) * (0.7 + 0.3 * sin(u * 3.1 + 1.0))
        let violet = Shade.gaussian(v, centre: wave2, width: 0.10) * (0.6 + 0.4 * sin(u * 2.3 + 3.0))
        c = c.under(slot(1), alpha: 0.32 * teal)
        c = c.under(slot(2), alpha: 0.28 * violet)
        // A faint wash where the curtains glow onto the sky below them.
        c = c.under(slot(1).mixed(with: slot(2), 0.5).scaled(0.62), alpha: 0.12 * Shade.gaussian(v, centre: 0.38, width: 0.22))
        return c
    }

    /// Soft rays from a light just above the frame, fading by a third of the
    /// way down.
    private func lightRays(_ u: Double, _ v: Double) -> ShadeColor {
        var c = slot(0).mixed(with: slot(0).scaled(0.6), v)
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
        c = c.under(slot(1), alpha: 0.30 * rays * cone * falloff)
        // The light itself, a soft pool where the rays begin.
        c = c.under(slot(2), alpha: 0.18 * exp(-distance * 5.5))
        return c
    }

    /// A grainy mesh of three soft blobs, warm against cool, kept dark.
    private func grainient(_ u: Double, _ v: Double) -> ShadeColor {
        var c = slot(0)
        let x = u * aspect
        func blob(_ bx: Double, _ by: Double, _ radius: Double) -> Double {
            let dx = x - bx * aspect
            let dy = v - by
            return exp(-(dx * dx + dy * dy) / (radius * radius))
        }
        c = c.under(slot(1), alpha: 0.85 * blob(0.18, 0.22, 0.42))
        c = c.under(slot(2), alpha: 0.55 * blob(0.92, 0.36, 0.34))
        c = c.under(slot(3), alpha: 0.75 * blob(0.42, 0.66, 0.40))
        return c
    }

    /// A fine grid of squares that is only there in the middle, like light
    /// falling on graph paper.
    private func shapeGrid(_ u: Double, _ v: Double) -> ShadeColor {
        var c = slot(0)
        let cell = 0.075
        let gx = (u * aspect).truncatingRemainder(dividingBy: cell) / cell
        let gy = v.truncatingRemainder(dividingBy: cell) / cell
        let line = 0.035
        let onLine = (gx < line || gx > 1 - line || gy < line || gy > 1 - line) ? 1.0 : 0.0
        let spot = exp(-pow(Shade.ellipse(u, v, cx: focus.x, cy: focus.y, rx: 0.75, ry: 0.5), 2) * 1.6)
        c = c.under(slot(1), alpha: 0.10 * onLine * spot)
        c = c.under(slot(2), alpha: 0.35 * spot)
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
