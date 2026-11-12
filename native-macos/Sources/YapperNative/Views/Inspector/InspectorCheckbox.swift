import SwiftUI

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
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(isOn ? Color.studioAccent : Color.studioTextMuted)
                    Text(title)
                        .font(.studioLabel)
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
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 20)
            }
        }
    }
}
