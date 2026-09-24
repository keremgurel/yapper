import SwiftUI

/// The editor for one skill or one knowledge section: a large centered
/// window. Settings sit in a narrow column; the main text takes the rest of
/// the room, so a long section is edited without scrolling a small box
/// inside a small box.
struct BrainEditorPanel<Side: View, Main: View>: View {
    let title: String
    var description: String?
    let onClose: () -> Void
    @ViewBuilder var side: () -> Side
    @ViewBuilder var main: () -> Main

    var body: some View {
        NativeModal(onClose: onClose) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 18, weight: .semibold))
                if let description {
                    Text(description).font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
        } content: {
            HStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) { side() }
                        .padding(28)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(width: 340)
                Rectangle().fill(Color.studioLine).frame(width: 1)
                VStack(alignment: .leading, spacing: 10) { main() }
                    .padding(28)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }
}

/// A long piece of writing that fills its space and scrolls inside itself.
struct BrainLongTextEditor: View {
    @Binding var text: String
    var placeholder: String
    var monospaced = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $text)
                .font(monospaced ? .system(size: 13, design: .monospaced) : .system(size: 15))
                .lineSpacing(4)
                .scrollContentBackground(.hidden)
                .padding(12)
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 15))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 17)
                    .padding(.vertical, 12)
                    .allowsHitTesting(false)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioInputBackground))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
    }
}
