import AppKit
import SwiftUI

/// The picker that opens beside a swatch: a saturation square, a hue bar, the
/// hex value, an eyedropper, and the house presets. It edits `hex` live; the
/// caller decides when that is saved.
struct BrandColorPicker: View {
    let role: BrandColorRole
    @Binding var hex: String
    /// A button under the picker, for adding rather than editing.
    var confirm: (title: String, run: () -> Void)?

    @State private var hsb = BrandHSB(hue: 0, saturation: 0, brightness: 0)
    @State private var hexText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(role.title).font(.system(size: 13, weight: .semibold))
                Text(role.hint).font(.system(size: 11)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            BrandSaturationSquare(value: $hsb)
            BrandHueSlider(hue: $hsb.hue)
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 6, style: .continuous).fill(hsb.color)
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
                    .frame(width: 28, height: 28)
                TextField("#RRGGBB", text: $hexText)
                    .textFieldStyle(.native)
                    .font(.system(size: 13).monospaced())
                    .onSubmit { apply(hexText) }
                Button { sample() } label: { Image(systemName: "eyedropper") }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .help("Pick a color from anywhere on screen")
            }
            presets
            if let confirm {
                Button(confirm.title, systemImage: "plus", action: confirm.run)
                    .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(14)
        .frame(width: 256)
        .onAppear {
            hsb = BrandHSB(hex: hex)
            hexText = hex
        }
        .onChange(of: hsb) { _, next in
            // Only drags and presets land here with a new value; typing
            // goes through `apply`, which sets both.
            let value = next.hex
            guard value != hex else { return }
            hex = value
            hexText = value
        }
    }

    private var presets: some View {
        HStack(spacing: 6) {
            ForEach(BrandLimits.suggestions, id: \.self) { preset in
                Button { apply(preset) } label: {
                    Circle().fill(BrandHex.color(preset))
                        .overlay(Circle().strokeBorder(preset == hex ? Color.yapperOrange : Color.studioLine, lineWidth: preset == hex ? 2 : 1))
                        .frame(width: 20, height: 20)
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
                .help(preset)
            }
        }
    }

    private func apply(_ text: String) {
        guard let value = BrandHex.normalize(text) else {
            hexText = hex
            return
        }
        hex = value
        hexText = value
        hsb = BrandHSB(hex: value)
    }

    private func sample() {
        NSColorSampler().show { picked in
            guard let picked else { return }
            apply(BrandHex.hex(Color(nsColor: picked)))
        }
    }
}
