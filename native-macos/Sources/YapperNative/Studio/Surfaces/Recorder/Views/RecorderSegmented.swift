import SwiftUI

/// A row of small choices where one is picked: text size, speed, lead-in.
struct RecorderSegmented<Value: Hashable & Sendable>: View {
    let options: [TeleprompterSettings.Option<Value>]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                let selected = option.value == selection
                Button { selection = option.value } label: {
                    Text(option.label)
                        .font(.system(size: 12, weight: selected ? .semibold : .regular))
                        .foregroundStyle(selected ? Color.primary : Color.secondary)
                        .frame(maxWidth: .infinity, minHeight: 26)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(selected ? Color.studioSelectedFill : Color.clear)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
            }
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground))
    }
}
