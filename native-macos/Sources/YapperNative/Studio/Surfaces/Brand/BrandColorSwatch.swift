import SwiftUI

/// One palette color: a block of the color, the system color well and a hex
/// field to change it, make primary, delete. Drag a swatch onto another to
/// reorder; the first swatch is primary.
struct BrandColorSwatch: View {
    let color: String
    let primary: Bool
    let busy: Bool
    let onChange: (String) -> Void
    let onPrimary: () -> Void
    let onDelete: () -> Void

    @State private var draft = ""
    @State private var pickerCommit: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            BrandHex.color(BrandHex.normalize(draft) ?? color)
                .frame(height: 96)
                .overlay(alignment: .topLeading) {
                    if primary { NativeChip(text: "Primary").padding(10) }
                }
            Rectangle().fill(Color.studioLine).frame(height: 1)
            HStack(spacing: 4) {
                ColorPicker("Choose \(color)", selection: pickerBinding, supportsOpacity: false)
                    .labelsHidden()
                    .frame(width: 30)
                TextField("#RRGGBB", text: $draft)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .medium).monospaced())
                    .onSubmit(commitDraft)
                    .accessibilityLabel("Hex value for \(color)")
                Spacer(minLength: 0)
                if !primary {
                    Button(action: onPrimary) { Image(systemName: "star").font(.system(size: 12)) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .help("Make primary")
                        .accessibilityLabel("Make \(color) primary")
                }
                BrandConfirmDeleteButton(label: "Remove \(color)", onConfirm: onDelete)
            }
            .disabled(busy)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .background(Color.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        .onAppear { draft = color }
        .onChange(of: color) { _, saved in draft = saved }
        .onDisappear { pickerCommit?.cancel() }
    }

    /// The color well fires on every drag step, so the save waits until the
    /// creator has stopped moving it for a moment.
    private var pickerBinding: Binding<Color> {
        Binding(
            get: { BrandHex.color(BrandHex.normalize(draft) ?? color) },
            set: { picked in
                draft = BrandHex.hex(picked)
                pickerCommit?.cancel()
                pickerCommit = Task {
                    try? await Task.sleep(for: .milliseconds(700))
                    guard !Task.isCancelled else { return }
                    commitDraft()
                }
            }
        )
    }

    private func commitDraft() {
        guard let next = BrandHex.normalize(draft) else {
            draft = color
            return
        }
        if next != color { onChange(next) }
        // The server's answer replaces `color`; until then show the saved one
        // if the save fails.
        draft = next
    }
}
