import SwiftUI

/// A panel that slides in from the right edge over a dimmed page: the
/// native form of the web's side sheet. Full height, one scrolling body, and
/// a footer that stays put so the main action is always in reach. Escape,
/// the close button or a click on the page behind closes it.
struct NativeDrawer<Header: View, Content: View, Footer: View>: View {
    var width: CGFloat = 460
    let onClose: () -> Void
    @ViewBuilder var header: () -> Header
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
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
                .padding(.horizontal, 24)
                .padding(.top, 22)
                .padding(.bottom, 18)
                Rectangle().fill(Color.studioLine).frame(height: 1)
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) { content() }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if Footer.self != EmptyView.self {
                    Rectangle().fill(Color.studioLine).frame(height: 1)
                    VStack(alignment: .leading, spacing: 10) { footer() }
                        .padding(.horizontal, 24)
                        .padding(.vertical, 18)
                }
            }
            .frame(width: width)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .frame(maxHeight: .infinity)
            .background(Color.panelBackground)
            .overlay(alignment: .leading) {
                Rectangle().fill(Color.studioLine).frame(width: 1)
            }
            .shadow(color: .black.opacity(0.18), radius: 24, x: -6)
        }
    }
}

extension View {
    /// Presents a `NativeDrawer` over this view while `item` is set.
    func nativeDrawer<Item: Identifiable, Drawer: View>(
        item: Binding<Item?>,
        @ViewBuilder drawer: @escaping (Item) -> Drawer
    ) -> some View {
        overlay {
            ZStack(alignment: .trailing) {
                if item.wrappedValue != nil {
                    Color.black.opacity(0.28)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture { item.wrappedValue = nil }
                        .transition(.opacity)
                }
                if let value = item.wrappedValue {
                    drawer(value)
                        .transition(.move(edge: .trailing))
                        .id(value.id)
                }
            }
            .animation(.spring(response: 0.36, dampingFraction: 0.9), value: item.wrappedValue?.id)
        }
    }
}
