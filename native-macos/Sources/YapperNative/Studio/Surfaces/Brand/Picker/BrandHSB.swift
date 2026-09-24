import AppKit
import SwiftUI

/// A color as the picker edits it: hue, saturation, brightness, each 0...1.
/// Hue is kept separately from the hex so dragging to grey and back does not
/// snap the hue to red.
struct BrandHSB: Equatable {
    var hue: Double
    var saturation: Double
    var brightness: Double

    init(hue: Double, saturation: Double, brightness: Double) {
        self.hue = hue
        self.saturation = saturation
        self.brightness = brightness
    }

    init(hex: String) {
        let rgb = NSColor(BrandHex.color(hex)).usingColorSpace(.sRGB) ?? .black
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0
        rgb.getHue(&h, saturation: &s, brightness: &b, alpha: nil)
        self.init(hue: h, saturation: s, brightness: b)
    }

    var color: Color { Color(hue: hue, saturation: saturation, brightness: brightness) }
    var hex: String { BrandHex.hex(color) }
}
