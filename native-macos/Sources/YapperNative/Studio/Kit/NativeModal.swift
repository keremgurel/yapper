import SwiftUI

/// A large centered window over a dimmed page, for work that needs the room:
/// long editors, not quick forms. It takes most of the window on every side,
/// with a header, a close button and a body that fills the rest. Escape, the
/// close button or a click on the page behind closes it.
struct NativeModal<Header: View, Content: View>: View {
    let onClose: () -> Void
    @ViewBuilder var header: () -> Header
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                header()
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .keyboardShortcut(.cancelAction)
                .help("Close")
            }
            .padding(.horizontal, 28)
            .padding(.top, 24)
            .padding(.bottom, 20)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .background(Color.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        .shadow(color: .black.opacity(0.3), radius: 40, y: 12)
    }
}

extension View {
    /// Presents a `NativeModal` centered over this view while `item` is set.
    /// The modal gets most of the space: 48pt from the sides and 40pt from
    /// the top and bottom, capped at 1320 wide so lines stay readable.
    func nativeModal<Item: Identifiable, Modal: View>(
        item: Binding<Item?>,
        @ViewBuilder modal: @escaping (Item) -> Modal
    ) -> some View {
        overlay {
            GeometryReader { proxy in
                ZStack {
                    if item.wrappedValue != nil {
                        Color.black.opacity(0.4)
                            .ignoresSafeArea()
                            .contentShape(Rectangle())
                            .onTapGesture { item.wrappedValue = nil }
                            .transition(.opacity)
                    }
                    if let value = item.wrappedValue {
                        modal(value)
                            .frame(
                                width: min(max(proxy.size.width - 96, 640), 1320),
                                height: max(proxy.size.height - 80, 520)
                            )
                            .transition(.opacity.combined(with: .scale(scale: 0.97)))
                            .id(value.id)
                    }
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .allowsHitTesting(item.wrappedValue != nil)
            .animation(.spring(response: 0.32, dampingFraction: 0.9), value: item.wrappedValue?.id)
        }
    }
}
