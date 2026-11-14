import SwiftUI

/// The level as a number you can type.
///
/// What is typed stays in the field and nowhere else until Return or a click
/// away, so "1" on the way to "125" never drops the track to one percent. A
/// value that is not a number puts the field back to the real level rather
/// than arguing about it.
struct VolumePercentField: View {
    let percent: Int
    let accessibilityName: String
    let onCommit: (Double) -> Void

    @State private var typed: String?
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 2) {
            TextField(
                "",
                text: Binding(
                    get: { typed ?? String(percent) },
                    set: { typed = $0 }
                )
            )
            .textFieldStyle(.plain)
            .accessibilityLabel("\(accessibilityName), percent")
            .multilineTextAlignment(.trailing)
            .font(.studioCaptionStrong)
            .monospacedDigit()
            .focused($focused)
            .frame(width: 30)
            .onSubmit(commitTyped)
            .onChange(of: focused) { _, isFocused in
                if !isFocused { commitTyped() }
            }
            .onExitCommand {
                typed = nil
                focused = false
            }

            Text("%")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 7)
        .frame(height: 24)
        .background(Color.studioInputBackground)
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(focused ? Color.studioAccent.opacity(0.7) : Color.studioLine, lineWidth: 1)
        }
        .help("Type a level, in percent. 100 is how it was recorded.")
    }

    private func commitTyped() {
        guard let entry = typed else { return }
        typed = nil
        guard let level = AudioLevel.percentTyped(entry) else { return }
        onCommit(level)
    }
}
