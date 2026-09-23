import SwiftUI

/// A borderless multi-line editor that grows with its words instead of
/// scrolling inside itself. Return makes a new line, as in any document.
struct IdeaCanvasGrowingEditor: View {
    @Binding var text: String
    var placeholder = ""
    var font: Font = .system(size: 15)
    var lineSpacing: CGFloat = 4
    var minHeight: CGFloat = 56
    /// Bump to put the cursor in the editor.
    var focusRequest = 0
    var onFocusChange: (Bool) -> Void = { _ in }

    @FocusState private var focused: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Sizes the stack: the same words, laid out the same way, hidden.
            Text(measured)
                .font(font)
                .lineSpacing(lineSpacing)
                .padding(.horizontal, 5)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .fixedSize(horizontal: false, vertical: true)
                .hidden()
            if text.isEmpty {
                Text(placeholder)
                    .font(font)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 5)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .font(font)
                .lineSpacing(lineSpacing)
                .scrollContentBackground(.hidden)
                .scrollDisabled(true)
                .background(Color.clear)
                .focused($focused)
        }
        .frame(minHeight: minHeight, alignment: .topLeading)
        .onChange(of: focused) { _, value in onFocusChange(value) }
        .onChange(of: focusRequest) { _, _ in focused = true }
        .onAppear { if focusRequest > 0 { focused = true } }
    }

    /// A trailing newline still takes a line on screen.
    private var measured: String {
        text.isEmpty ? " " : (text.hasSuffix("\n") ? text + " " : text)
    }
}
