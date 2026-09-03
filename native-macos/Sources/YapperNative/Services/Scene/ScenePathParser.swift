import CoreGraphics
import Foundation

/// Reads SVG path data into a `CGPath`.
///
/// Handles the whole command set, absolute and relative, with the implicit
/// repeats and the compact number forms real path data uses ("l.5-.5",
/// "a.5.5 0 0 1 .9 0"). Arcs become cubic Béziers because Core Graphics has no
/// endpoint arc. Anything it cannot read comes back as nil, never a crash: the
/// validator has already screened the characters, but a stream of legal
/// characters can still fail to be a path, and the renderer must shrug.
enum ScenePathParser {
    /// The path in the coordinates the data was written in, top-left origin.
    static func path(from data: String) -> CGPath? {
        var scanner = Scanner(text: data)
        let path = CGMutablePath()
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero
        var lastControl: CGPoint?
        var lastCommand: Character = " "
        var command: Character?
        var sawCommand = false

        while true {
            scanner.skipSeparators()
            guard let next = scanner.peek() else { break }
            if next.isLetter {
                command = scanner.take()
                if command == "M" || command == "m" {
                    // Nothing.
                } else if !sawCommand {
                    return nil
                }
            } else if command == nil {
                return nil
            } else if command == "Z" || command == "z" {
                return nil
            } else if command == "M" {
                command = "L"
            } else if command == "m" {
                command = "l"
            }
            guard let letter = command else { return nil }
            sawCommand = true
            let relative = letter.isLowercase
            let origin = relative ? current : .zero

            switch letter.uppercased() {
            case "M":
                guard let point = scanner.point(offset: origin) else { return nil }
                path.move(to: point)
                current = point
                subpathStart = point
                lastControl = nil
            case "L":
                guard let point = scanner.point(offset: origin) else { return nil }
                path.addLine(to: point)
                current = point
                lastControl = nil
            case "H":
                guard let x = scanner.number() else { return nil }
                current = CGPoint(x: origin.x + x, y: current.y)
                path.addLine(to: current)
                lastControl = nil
            case "V":
                guard let y = scanner.number() else { return nil }
                current = CGPoint(x: current.x, y: origin.y + y)
                path.addLine(to: current)
                lastControl = nil
            case "C":
                guard let c1 = scanner.point(offset: origin),
                      let c2 = scanner.point(offset: origin),
                      let end = scanner.point(offset: origin)
                else { return nil }
                path.addCurve(to: end, control1: c1, control2: c2)
                lastControl = c2
                current = end
            case "S":
                guard let c2 = scanner.point(offset: origin),
                      let end = scanner.point(offset: origin)
                else { return nil }
                let c1 = reflected(lastControl, about: current, ifPrevious: lastCommand, in: "CcSs")
                path.addCurve(to: end, control1: c1, control2: c2)
                lastControl = c2
                current = end
            case "Q":
                guard let control = scanner.point(offset: origin),
                      let end = scanner.point(offset: origin)
                else { return nil }
                path.addQuadCurve(to: end, control: control)
                lastControl = control
                current = end
            case "T":
                guard let end = scanner.point(offset: origin) else { return nil }
                let control = reflected(lastControl, about: current, ifPrevious: lastCommand, in: "QqTt")
                path.addQuadCurve(to: end, control: control)
                lastControl = control
                current = end
            case "A":
                guard let rx = scanner.number(), let ry = scanner.number(),
                      let rotation = scanner.number(),
                      let large = scanner.flag(), let sweep = scanner.flag(),
                      let end = scanner.point(offset: origin)
                else { return nil }
                SceneArcConverter.addArc(
                    to: path,
                    from: current,
                    to: end,
                    radii: CGSize(width: rx, height: ry),
                    rotationDegrees: rotation,
                    largeArc: large,
                    sweep: sweep
                )
                current = end
                lastControl = nil
            case "Z":
                path.closeSubpath()
                current = subpathStart
                lastControl = nil
            default:
                return nil
            }
            lastCommand = letter
        }
        guard sawCommand, !path.isEmpty else { return nil }
        return path
    }

    /// The first control point of a smooth curve: the previous one mirrored
    /// through the current point, or the current point itself when the last
    /// command was not the matching kind of curve.
    private static func reflected(
        _ control: CGPoint?,
        about point: CGPoint,
        ifPrevious previous: Character,
        in family: String
    ) -> CGPoint {
        guard let control, family.contains(previous) else { return point }
        return CGPoint(x: 2 * point.x - control.x, y: 2 * point.y - control.y)
    }

    // MARK: - Scanning

    private struct Scanner {
        private let characters: [Character]
        private var index = 0

        init(text: String) {
            characters = Array(text)
        }

        func peek() -> Character? {
            index < characters.count ? characters[index] : nil
        }

        mutating func take() -> Character {
            defer { index += 1 }
            return characters[index]
        }

        mutating func skipSeparators() {
            while let c = peek(), c == "," || c.isWhitespace { index += 1 }
        }

        mutating func point(offset: CGPoint) -> CGPoint? {
            guard let x = number(), let y = number() else { return nil }
            return CGPoint(x: offset.x + x, y: offset.y + y)
        }

        /// A number in path data. A sign or a decimal point may start the next
        /// number without any separator ("1-2", ".5.5"), so the scan stops at
        /// the first character that cannot continue this one.
        mutating func number() -> CGFloat? {
            skipSeparators()
            var text = ""
            var sawDigit = false
            var sawPoint = false
            var sawExponent = false
            if let c = peek(), c == "-" || c == "+" {
                text.append(take())
            }
            while let c = peek() {
                if c.isNumber, c.isASCII {
                    text.append(take())
                    sawDigit = true
                } else if c == ".", !sawPoint, !sawExponent {
                    text.append(take())
                    sawPoint = true
                } else if (c == "e" || c == "E"), sawDigit, !sawExponent {
                    sawExponent = true
                    text.append(take())
                    if let sign = peek(), sign == "-" || sign == "+" { text.append(take()) }
                } else {
                    break
                }
            }
            guard sawDigit, let value = Double(text), value.isFinite else { return nil }
            return CGFloat(value)
        }

        /// An arc flag is exactly one character, and may be glued to the
        /// number after it ("0 01 .9" reads as 0, 0, 1, 0.9).
        mutating func flag() -> Bool? {
            skipSeparators()
            guard let c = peek(), c == "0" || c == "1" else { return nil }
            index += 1
            return c == "1"
        }
    }
}

/// SVG endpoint arcs as cubic Béziers, following the conversion in the SVG
/// implementation notes (F.6.5). Each quarter turn or less becomes one curve.
enum SceneArcConverter {
    static func addArc(
        to path: CGMutablePath,
        from start: CGPoint,
        to end: CGPoint,
        radii: CGSize,
        rotationDegrees: CGFloat,
        largeArc: Bool,
        sweep: Bool
    ) {
        if start == end { return }
        var rx = abs(radii.width)
        var ry = abs(radii.height)
        guard rx > 0, ry > 0 else {
            path.addLine(to: end)
            return
        }
        let phi = rotationDegrees * .pi / 180
        let cosPhi = cos(phi)
        let sinPhi = sin(phi)

        // Step 1: the midpoint in the rotated frame.
        let dx = (start.x - end.x) / 2
        let dy = (start.y - end.y) / 2
        let x1 = cosPhi * dx + sinPhi * dy
        let y1 = -sinPhi * dx + cosPhi * dy

        // Radii too small to reach are scaled up until they just do.
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            let scale = sqrt(lambda)
            rx *= scale
            ry *= scale
        }

        // Step 2: the centre in the rotated frame.
        let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var factor = denominator > 0 ? sqrt(max(0, numerator / denominator)) : 0
        if largeArc == sweep { factor = -factor }
        let cx1 = factor * (rx * y1 / ry)
        let cy1 = factor * (-(ry * x1) / rx)

        // Step 3: the centre back in the original frame.
        let cx = cosPhi * cx1 - sinPhi * cy1 + (start.x + end.x) / 2
        let cy = sinPhi * cx1 + cosPhi * cy1 + (start.y + end.y) / 2

        // Step 4: the angles.
        let startVector = CGPoint(x: (x1 - cx1) / rx, y: (y1 - cy1) / ry)
        let endVector = CGPoint(x: (-x1 - cx1) / rx, y: (-y1 - cy1) / ry)
        let theta1 = angle(from: CGPoint(x: 1, y: 0), to: startVector)
        var delta = angle(from: startVector, to: endVector)
        if !sweep, delta > 0 { delta -= 2 * .pi }
        if sweep, delta < 0 { delta += 2 * .pi }

        let segments = max(1, Int(ceil(abs(delta) / (.pi / 2) - 0.000_01)))
        let step = delta / CGFloat(segments)
        var angle = theta1
        var from = start
        for _ in 0 ..< segments {
            let next = angle + step
            let to = point(at: next, cx: cx, cy: cy, rx: rx, ry: ry, cosPhi: cosPhi, sinPhi: sinPhi)
            // The control distance for a circular arc of `step` radians.
            let alpha = sin(step) * (sqrt(4 + 3 * pow(tan(step / 2), 2)) - 1) / 3
            let d1 = derivative(at: angle, rx: rx, ry: ry, cosPhi: cosPhi, sinPhi: sinPhi)
            let d2 = derivative(at: next, rx: rx, ry: ry, cosPhi: cosPhi, sinPhi: sinPhi)
            let c1 = CGPoint(x: from.x + alpha * d1.x, y: from.y + alpha * d1.y)
            let c2 = CGPoint(x: to.x - alpha * d2.x, y: to.y - alpha * d2.y)
            path.addCurve(to: to, control1: c1, control2: c2)
            angle = next
            from = to
        }
    }

    private static func point(
        at angle: CGFloat, cx: CGFloat, cy: CGFloat, rx: CGFloat, ry: CGFloat,
        cosPhi: CGFloat, sinPhi: CGFloat
    ) -> CGPoint {
        let x = rx * cos(angle)
        let y = ry * sin(angle)
        return CGPoint(x: cx + cosPhi * x - sinPhi * y, y: cy + sinPhi * x + cosPhi * y)
    }

    private static func derivative(
        at angle: CGFloat, rx: CGFloat, ry: CGFloat, cosPhi: CGFloat, sinPhi: CGFloat
    ) -> CGPoint {
        let x = -rx * sin(angle)
        let y = ry * cos(angle)
        return CGPoint(x: cosPhi * x - sinPhi * y, y: sinPhi * x + cosPhi * y)
    }

    private static func angle(from u: CGPoint, to v: CGPoint) -> CGFloat {
        let dot = u.x * v.x + u.y * v.y
        let length = sqrt((u.x * u.x + u.y * u.y) * (v.x * v.x + v.y * v.y))
        guard length > 0 else { return 0 }
        var angle = acos(min(1, max(-1, dot / length)))
        if u.x * v.y - u.y * v.x < 0 { angle = -angle }
        return angle
    }
}
