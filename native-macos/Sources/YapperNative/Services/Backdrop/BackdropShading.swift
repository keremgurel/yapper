import Foundation

/// The arithmetic the backdrop presets are drawn with: a colour, a blend, and
/// the gradient shapes CSS has names for. Written out so a preset reads like
/// the CSS it was tuned from, and so the same numbers can be ported to the
/// agent skill's renderer line for line.
struct ShadeColor: Equatable, Sendable {
    var r: Double
    var g: Double
    var b: Double

    /// From 0 to 255 per channel, the way the references were written.
    init(_ r: Double, _ g: Double, _ b: Double) {
        self.r = r / 255
        self.g = g / 255
        self.b = b / 255
    }

    init(unit r: Double, _ g: Double, _ b: Double) {
        self.r = r
        self.g = g
        self.b = b
    }

    /// From `#RRGGBB`. Anything else reads as black.
    init(hexString: String) {
        let digits = hexString.hasPrefix("#") ? String(hexString.dropFirst()) : hexString
        self.init(hex: UInt32(digits, radix: 16) ?? 0)
    }

    init(hex: UInt32) {
        self.init(Double((hex >> 16) & 0xFF), Double((hex >> 8) & 0xFF), Double(hex & 0xFF))
    }

    /// `top` laid over this colour at `alpha`.
    func under(_ top: ShadeColor, alpha: Double) -> ShadeColor {
        let a = Shade.clamp(alpha)
        return ShadeColor(unit: r + (top.r - r) * a, g + (top.g - g) * a, b + (top.b - b) * a)
    }

    /// This colour mixed toward `other`, by `t`.
    func mixed(with other: ShadeColor, _ t: Double) -> ShadeColor {
        under(other, alpha: t)
    }

    func scaled(_ factor: Double) -> ShadeColor {
        ShadeColor(unit: r * factor, g * factor, b * factor)
    }

    func adding(_ amount: Double) -> ShadeColor {
        ShadeColor(unit: r + amount, g + amount, b + amount)
    }
}

/// A colour and an opacity at a point along a gradient, from 0 to 1.
struct ShadeStop: Sendable {
    let at: Double
    let color: ShadeColor
    let alpha: Double

    init(_ at: Double, _ color: ShadeColor, _ alpha: Double) {
        self.at = at
        self.color = color
        self.alpha = alpha
    }
}

enum Shade {
    static func clamp(_ x: Double, _ lo: Double = 0, _ hi: Double = 1) -> Double {
        min(hi, max(lo, x))
    }

    static func smoothstep(_ edge0: Double, _ edge1: Double, _ x: Double) -> Double {
        let t = clamp((x - edge0) / (edge1 - edge0))
        return t * t * (3 - 2 * t)
    }

    /// Where a gradient is at `t`, as colour and opacity, interpolated
    /// straight between the stops either side the way CSS does.
    static func sample(_ stops: [ShadeStop], at t: Double) -> (color: ShadeColor, alpha: Double) {
        guard let first = stops.first, let last = stops.last else {
            return (ShadeColor(0, 0, 0), 0)
        }
        if t <= first.at { return (first.color, first.alpha) }
        if t >= last.at { return (last.color, last.alpha) }
        for index in 1 ..< stops.count where t <= stops[index].at {
            let a = stops[index - 1]
            let b = stops[index]
            let k = (t - a.at) / max(0.000_001, b.at - a.at)
            return (a.color.mixed(with: b.color, k), a.alpha + (b.alpha - a.alpha) * k)
        }
        return (last.color, last.alpha)
    }

    /// How far a point is from the middle of a CSS `radial-gradient(rx ry at
    /// cx cy)`, where 1 is the edge of the ellipse. All in fractions of the
    /// frame, as CSS percentages are.
    static func ellipse(_ u: Double, _ v: Double, cx: Double, cy: Double, rx: Double, ry: Double) -> Double {
        let dx = (u - cx) / rx
        let dy = (v - cy) / ry
        return (dx * dx + dy * dy).squareRoot()
    }

    /// The colour a radial gradient lays over `base` at this point.
    static func radial(
        _ base: ShadeColor,
        _ u: Double, _ v: Double,
        cx: Double, cy: Double, rx: Double, ry: Double,
        stops: [ShadeStop]
    ) -> ShadeColor {
        let sample = sample(stops, at: ellipse(u, v, cx: cx, cy: cy, rx: rx, ry: ry))
        return base.under(sample.color, alpha: sample.alpha)
    }

    /// A smooth bump: 1 at `centre`, falling off over `width` either side.
    static func gaussian(_ x: Double, centre: Double, width: Double) -> Double {
        let d = (x - centre) / width
        return exp(-d * d)
    }

    /// The same noise for the same pixel on every frame and every machine, so
    /// grain holds still and an export matches its preview.
    static func hash(_ x: Int, _ y: Int, seed: UInt32 = 7) -> Double {
        var h = UInt32(truncatingIfNeeded: x) &* 374_761_393
            &+ UInt32(truncatingIfNeeded: y) &* 668_265_263
            &+ seed &* 2_246_822_519
        h = (h ^ (h >> 13)) &* 1_274_126_177
        h ^= h >> 16
        return Double(h) / Double(UInt32.max)
    }
}
