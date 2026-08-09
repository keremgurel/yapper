import SwiftUI

/// A colour swatch that opens the picker every design tool has: the handful of
/// colours worth reaching for first, a hex field for the exact one, an opacity
/// slider, and the system picker behind "Custom" for everything else.
struct InspectorColorWell: View {
    let color: StudioColor
    var supportsOpacity = true
    /// `live` is true while a slider or the system picker is streaming, so the
    /// caller can fold the whole gesture into one undo step.
    let onChange: (StudioColor, Bool) -> Void

    @State private var isPickerPresented = false

    var body: some View {
        HStack(spacing: 8) {
            Button {
                isPickerPresented.toggle()
            } label: {
                swatch
            }
            .buttonStyle(.studioPlain)
            .popover(isPresented: $isPickerPresented, arrowEdge: .bottom) {
                InspectorColorPicker(
                    color: color,
                    supportsOpacity: supportsOpacity,
                    onChange: onChange
                )
            }

            Text(color.hex)
                .font(.system(size: 10.5, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)
        }
    }

    private var swatch: some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(color.swiftUIColor)
            .background {
                // Under a translucent colour, so "20% white" does not read as
                // "nearly the panel".
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(CheckerboardPattern.shading)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(Color.studioLineStrong, lineWidth: 1)
            }
            .frame(width: 34, height: 22)
    }
}

/// The popover's contents, kept apart from the swatch so the swatch stays a
/// swatch.
private struct InspectorColorPicker: View {
    let color: StudioColor
    let supportsOpacity: Bool
    let onChange: (StudioColor, Bool) -> Void

    @State private var hex = ""

    private let columns = Array(repeating: GridItem(.fixed(24), spacing: 8), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(StudioColor.presets, id: \.hex) { preset in
                    swatchButton(preset)
                }
            }

            if supportsOpacity {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Opacity")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        Slider(
                            value: Binding(
                                get: { color.opacity * 100 },
                                set: { onChange(color.withOpacity($0 / 100), true) }
                            ),
                            in: 0 ... 100
                        )
                        .controlSize(.small)
                        .tint(Color.yapperOrange)
                        InspectorNumberField(
                            value: color.opacity * 100,
                            range: 0 ... 100,
                            width: 40,
                            onCommit: { onChange(color.withOpacity($0 / 100), false) }
                        )
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Hex", text: $hex)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .frame(width: 84, height: 22)
                    .padding(.horizontal, 6)
                    .background(Color.studioInputBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                    .onSubmit(commitHex)

                ColorPicker(
                    "",
                    selection: Binding(
                        get: { color.swiftUIColor },
                        set: { picked in
                            guard let converted = StudioColor(picked, keepingOpacityOf: color) else { return }
                            onChange(converted, true)
                        }
                    ),
                    supportsOpacity: false
                )
                .labelsHidden()
                .help("Custom colour")
            }
        }
        .padding(14)
        .frame(width: 190)
        .onAppear { hex = color.hex }
        .onChange(of: color) { _, updated in hex = updated.hex }
    }

    private func swatchButton(_ preset: StudioColor) -> some View {
        let isSelected = preset.hex == color.withOpacity(1).hex
        return Button {
            onChange(preset.withOpacity(color.opacity), false)
        } label: {
            Circle()
                .fill(preset.swiftUIColor)
                .overlay {
                    Circle().strokeBorder(Color.studioLineStrong, lineWidth: 1)
                }
                .overlay {
                    if isSelected {
                        Circle()
                            .strokeBorder(Color.yapperOrange, lineWidth: 2)
                            .padding(-3)
                    }
                }
                .frame(width: 22, height: 22)
        }
        .buttonStyle(.studioPlain)
    }

    private func commitHex() {
        guard let parsed = StudioColor(hex: hex) else {
            hex = color.hex
            return
        }
        onChange(parsed, false)
    }
}

/// The grey chequerboard that means "this is see-through".
enum CheckerboardPattern {
    static let shading = ImagePaint(
        image: Image(nsImage: tile),
        scale: 1
    )

    private static let tile: NSImage = {
        let size = CGSize(width: 8, height: 8)
        let image = NSImage(size: size)
        image.lockFocus()
        NSColor.white.withAlphaComponent(0.28).setFill()
        CGRect(origin: .zero, size: size).fill()
        NSColor.black.withAlphaComponent(0.28).setFill()
        CGRect(x: 0, y: 0, width: 4, height: 4).fill()
        CGRect(x: 4, y: 4, width: 4, height: 4).fill()
        image.unlockFocus()
        return image
    }()
}

extension StudioColor {
    /// Reads a colour back out of SwiftUI's picker, keeping the opacity the
    /// property already had — the system picker is asked not to offer one.
    init?(_ color: Color, keepingOpacityOf existing: StudioColor) {
        guard let converted = NSColor(color).usingColorSpace(.sRGB) else { return nil }
        self.init(
            red: Double(converted.redComponent),
            green: Double(converted.greenComponent),
            blue: Double(converted.blueComponent),
            opacity: existing.opacity
        )
    }
}
