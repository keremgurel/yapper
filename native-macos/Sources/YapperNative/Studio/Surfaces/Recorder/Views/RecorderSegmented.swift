import SwiftUI

/// A row of small choices where one is picked: text size, speed, lead-in.
struct RecorderSegmented<Value: Hashable & Sendable>: View {
    let options: [TeleprompterSettings.Option<Value>]
    @Binding var selection: Value
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                let selected = option.value == selection
                Button {
                    let keyboard = NSApp.currentEvent?.type == .keyDown
                    withAnimation(reduceMotion || keyboard ? nil : .easeOut(duration: 0.14)) { selection = option.value }
                } label: {
                    Text(option.label)
                        .font(.system(size: 12, weight: selected ? .semibold : .regular))
                        .foregroundStyle(selected ? Color.primary : Color.secondary)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .contentShape(Rectangle())
                }
                .accessibilityAddTraits(selected ? .isSelected : [])
                .accessibilityValue(selected ? "Selected" : "Not selected")
                .buttonStyle(.studioPlain)
                .clickableCursor()
            }
        }
        .background {
            RecorderLiquidSelection(position: CGFloat(options.firstIndex { $0.value == selection } ?? 0),
                target: CGFloat(options.firstIndex { $0.value == selection } ?? 0), count: options.count)
                .allowsHitTesting(false).accessibilityHidden(true)
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground))
    }
}

/// Native counterpart of Gooey's moving surface: only the background is filtered.
/// Text and real buttons stay sharp, independently focusable and stationary.
private nonisolated struct RecorderLiquidSelection: View, Animatable {
    var position: CGFloat
    var target: CGFloat
    let count: Int
    var animatableData: CGFloat {
        get { position }
        set { position = newValue }
    }
    var body: some View {
        Canvas { context, size in
            let slot = size.width / CGFloat(max(1, count))
            let frame = CGRect(x: position * slot + 2, y: 2, width: max(1, slot - 4), height: size.height - 4)
            context.addFilter(.alphaThreshold(min: 0.5, color: .studioSelectedFill))
            context.addFilter(.blur(radius: 3))
            context.drawLayer { layer in
                layer.fill(Path(roundedRect: frame, cornerRadius: 8), with: .color(.white))
                let distance = min(1, abs(target - position))
                let stretch = sin(distance * .pi) * 10
                let x = target > position ? frame.minX - stretch : frame.maxX + stretch - 12
                layer.fill(Path(ellipseIn: CGRect(x: x, y: frame.midY - 6, width: 12, height: 12)), with: .color(.white))
            }
        }
    }
}
