import SwiftUI

/// The text field every native form uses: sunken fill, hairline, 8pt corners.
struct NativeTextFieldStyle: TextFieldStyle {
    var size: CGFloat = 13
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .textFieldStyle(.plain)
            .font(.system(size: size))
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
    }
}

extension TextFieldStyle where Self == NativeTextFieldStyle {
    static var native: NativeTextFieldStyle { NativeTextFieldStyle() }
}

/// A multi-line field that grows with its text, for anything longer than a
/// line: an Essentials answer, a script, a hook.
struct NativeTextArea: View {
    @Binding var text: String
    var placeholder = ""
    var font: Font = .system(size: 14)
    var minHeight: CGFloat = 64
    var chrome = true

    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .textFieldStyle(.plain)
            .font(font)
            .lineSpacing(3)
            .frame(minHeight: minHeight, alignment: .topLeading)
            .padding(chrome ? 10 : 0)
            .background {
                if chrome {
                    RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
                }
            }
    }
}

/// A label above a control, in sentence case.
struct NativeField<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.nativeLabel).foregroundStyle(.secondary)
            content()
        }
    }
}
