import SwiftUI

/// The editor for one skill or one knowledge section: a wide panel from the
/// right, full height. Settings sit in a narrow column; the main text takes
/// the rest of the room, so a long section is edited without scrolling a
/// small box inside a small box.
struct BrainEditorPanel<Side: View, Main: View>: View {
    let title: String
    var description: String?
    let onClose: () -> Void
    @ViewBuilder var side: () -> Side
    @ViewBuilder var main: () -> Main

    var body: some View {
        GeometryReader { proxy in
            NativeDrawer(width: min(max(proxy.size.width * 0.72, 760), 1120), fills: true, onClose: onClose) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 17, weight: .semibold))
                    if let description {
                        Text(description).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }
            } content: {
                HStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) { side() }
                            .padding(24)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(width: 320)
                    Rectangle().fill(Color.studioLine).frame(width: 1)
                    VStack(alignment: .leading, spacing: 10) { main() }
                        .padding(24)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            } footer: {
                EmptyView()
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
