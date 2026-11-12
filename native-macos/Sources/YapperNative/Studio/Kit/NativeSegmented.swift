import SwiftUI

/// A small segmented control: a stone tray, the chosen option lifted onto a
/// raised white pill, and an optional colour dot per option (a format's colour, for
/// instance). For a handful of short choices that should all stay visible.
struct NativeSegmented<Value: Hashable>: View {
    struct Option: Identifiable {
        let value: Value
        let label: String
        var dot: Color?
        var id: Value { value }
    }

    let options: [Option]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                let on = option.value == selection
                Button { withAnimation(.snappy(duration: 0.15)) { selection = option.value } } label: {
                    HStack(spacing: 6) {
                        if let dot = option.dot { Circle().fill(dot).frame(width: 6, height: 6) }
                        Text(option.label).font(.system(size: 12, weight: .medium))
                    }
                    .foregroundStyle(on ? Color.primary : Color.secondary)
                    .padding(.horizontal, 11)
                    .frame(height: 24)
                    .background {
                        if on {
                            Capsule(style: .continuous)
                                .fill(Color.studioRaisedChip)
                                .shadow(color: .black.opacity(0.10), radius: 1.5, y: 1)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Capsule(style: .continuous).fill(Color.studioTray))
        .fixedSize()
    }
}

extension NativeSegmented where Value == IdeaCanvasVersionFormat {
    /// The three version formats, each with its colour.
    static func formats(selection: Binding<IdeaCanvasVersionFormat>) -> NativeSegmented {
        NativeSegmented(
            options: IdeaCanvasVersionFormat.allCases.map { Option(value: $0, label: $0.label, dot: $0.tone.color) },
            selection: selection
        )
    }
}
