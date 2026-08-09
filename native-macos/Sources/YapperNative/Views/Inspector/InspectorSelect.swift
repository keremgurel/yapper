import SwiftUI

/// A dropdown, for a choice with more options than a row of segments can hold.
///
/// The looks used to be a grid of nine tiles that had to be unfolded before any
/// of them could be seen, which put the first decision a creator makes — which
/// look is this — behind a disclosure and three rows of scrolling. A dropdown
/// puts the current answer on screen at all times and the rest one click away,
/// which is the right shape for a list this long.
struct InspectorSelect<Value: Hashable>: View {
    struct Option: Identifiable {
        var value: Value
        var label: String

        var id: Value { value }
    }

    let options: [Option]
    let selection: Value
    /// Shown when nothing in the list matches, which for a look means the
    /// creator has since changed the font or the colour by hand.
    var emptyLabel = "Custom"
    let onSelect: (Value) -> Void

    private var current: String {
        options.first { $0.value == selection }?.label ?? emptyLabel
    }

    var body: some View {
        // A picker, not a menu with a hand-drawn label.
        //
        // The first version was a `Menu` wearing a custom label, and
        // `.borderlessButton` threw most of that away: the box and the border
        // never drew, the chevron came back on the wrong side, and what was
        // left read as a stray word rather than a control you could open. A
        // pop-up button is what macOS uses for exactly this, it draws its own
        // frame, and it shows the current answer without being asked.
        Picker(
            "",
            selection: Binding(
                get: { selection },
                set: { onSelect($0) }
            )
        ) {
            ForEach(options) { option in
                Text(option.label).tag(option.value)
            }
            // Only offered when nothing matches, so choosing it is never a way
            // to make a look called "Custom".
            if !options.contains(where: { $0.value == selection }) {
                Text(emptyLabel).tag(selection)
            }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .controlSize(.small)
        .fixedSize()
        .clickableCursor()
    }
}

/// A checkbox, for a plain yes or no.
///
/// Not a two-segment control: "All captions / Selected 1" looked like a choice
/// between two things when it is one thing being on or off, and a control that
/// misrepresents its own question makes people stop and read it every time.
struct InspectorCheckbox: View {
    let title: String
    @Binding var isOn: Bool
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Button {
                isOn.toggle()
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: isOn ? "checkmark.square.fill" : "square")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(isOn ? Color.yapperOrange : Color.secondary)
                    Text(title)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.primary)
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()

            if let detail {
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 19)
            }
        }
    }
}
