import Foundation

/// An sRGB colour with opacity, stored as a hex string so a saved project stays
/// readable and diffable. Kept free of AppKit and SwiftUI on purpose: the model
/// layer describes the colour, the view and the export decide how to draw it.
struct StudioColor: Codable, Equatable, Hashable, Sendable {
    var red: Double
    var green: Double
    var blue: Double
    var opacity: Double

    /// Channels are snapped to the 8-bit grid the hex form can actually hold.
    /// Without that, a colour saved as `#000000DB` would come back a hair off
    /// the one that was written — which would make a project stop matching its
    /// own template the moment it was reopened.
    init(red: Double, green: Double, blue: Double, opacity: Double = 1) {
        self.red = StudioColor.quantize(red)
        self.green = StudioColor.quantize(green)
        self.blue = StudioColor.quantize(blue)
        self.opacity = StudioColor.quantize(opacity)
    }

    /// `#RGB`, `#RRGGBB` and `#RRGGBBAA` all parse, with or without the hash.
    init?(hex: String) {
        var digits = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if digits.hasPrefix("#") { digits.removeFirst() }
        if digits.count == 3 {
            digits = digits.map { "\($0)\($0)" }.joined()
        }
        guard digits.count == 6 || digits.count == 8,
              let value = UInt32(digits, radix: 16)
        else { return nil }
        let hasAlpha = digits.count == 8
        let shift: UInt32 = hasAlpha ? 8 : 0
        self.init(
            red: Double((value >> (16 + shift)) & 0xFF) / 255,
            green: Double((value >> (8 + shift)) & 0xFF) / 255,
            blue: Double((value >> shift) & 0xFF) / 255,
            opacity: hasAlpha ? Double(value & 0xFF) / 255 : 1
        )
    }

    /// Six digits when the colour is opaque, eight when it is not, so the common
    /// case reads the way a designer would write it.
    var hex: String {
        let channels = [red, green, blue].map { UInt8(($0 * 255).rounded()) }
        let base = channels.map { String(format: "%02X", $0) }.joined()
        guard opacity < 1 else { return "#\(base)" }
        return "#\(base)\(String(format: "%02X", UInt8((opacity * 255).rounded())))"
    }

    /// The same colour at a different opacity, for swatches and previews.
    func withOpacity(_ value: Double) -> StudioColor {
        StudioColor(red: red, green: green, blue: blue, opacity: value)
    }

    private static func quantize(_ value: Double) -> Double {
        (min(1, max(0, value)) * 255).rounded() / 255
    }

    // MARK: - Codable

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let parsed = StudioColor(hex: raw) else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "\(raw) is not a hex colour"
            )
        }
        self = parsed
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(hex)
    }
}

extension StudioColor {
    static let white = StudioColor(red: 1, green: 1, blue: 1)
    static let black = StudioColor(red: 0, green: 0, blue: 0)
    /// The brand orange, matching `--sg-accent`.
    static let brand = StudioColor(red: 1, green: 0.48, blue: 0.13)

    /// The swatches the picker offers first. Short and opinionated: colours that
    /// hold up over footage, not a full palette.
    static let presets: [StudioColor] = [
        .white,
        .black,
        .brand,
        StudioColor(hex: "#FFD93D") ?? .white, // highlight yellow
        StudioColor(hex: "#33D17A") ?? .white, // signal green
        StudioColor(hex: "#3B9DFF") ?? .white, // link blue
        StudioColor(hex: "#FF4D6D") ?? .white, // alert pink
        StudioColor(hex: "#B388FF") ?? .white, // soft violet
    ]
}
