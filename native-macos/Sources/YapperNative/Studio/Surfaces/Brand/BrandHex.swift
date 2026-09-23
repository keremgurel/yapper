import AppKit
import SwiftUI

/// Hex colors as the brand route stores them: `#RRGGBB`, upper case.
enum BrandHex {
    /// `#RGB` or `#RRGGBB` (the `#` optional) to `#RRGGBB`; nil otherwise.
    static func normalize(_ value: String) -> String? {
        var text = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.allSatisfy(\.isHexDigit) else { return nil }
        if text.count == 3 { return "#" + text.map { "\($0)\($0)" }.joined() }
        return text.count == 6 ? "#" + text : nil
    }

    static func color(_ hex: String) -> Color {
        guard let normalized = normalize(hex), let value = UInt32(normalized.dropFirst(), radix: 16) else {
            return .gray
        }
        return Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }

    static func hex(_ color: Color) -> String {
        guard let rgb = NSColor(color).usingColorSpace(.sRGB) else { return "#000000" }
        func byte(_ component: CGFloat) -> Int { Int((min(max(component, 0), 1) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", byte(rgb.redComponent), byte(rgb.greenComponent), byte(rgb.blueComponent))
    }

    /// The first suggestion not already in the palette.
    static func next(after colors: [String]) -> String? {
        guard colors.count < BrandLimits.maxColors else { return nil }
        return BrandLimits.suggestions.first { !colors.contains($0) }
    }
}
