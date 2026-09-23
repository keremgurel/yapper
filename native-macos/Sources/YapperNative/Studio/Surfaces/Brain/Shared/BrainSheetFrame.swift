import SwiftUI

/// The chrome every Brain sheet shares: a title, one line of what it is for,
/// a close button, scrolling content and an optional pinned footer.
struct BrainSheetFrame<Content: View, Footer: View>: View {
    let title: String
    var description: String?
    var closeDisabled = false
    let onClose: () -> Void
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.nativeSectionTitle)
                    if let description {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark").font(.system(size: 12, weight: .medium)).frame(width: 24, height: 24)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .keyboardShortcut(.cancelAction)
                .disabled(closeDisabled)
                .accessibilityLabel("Close")
            }
            .padding(20)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) { content() }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
            }
            footer()
        }
        .frame(width: 600)
        .frame(minHeight: 420, idealHeight: 640, maxHeight: 760)
        .background(Color.panelBackground)
    }
}

extension BrainSheetFrame where Footer == EmptyView {
    init(
        title: String,
        description: String? = nil,
        closeDisabled: Bool = false,
        onClose: @escaping () -> Void,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.init(title: title, description: description, closeDisabled: closeDisabled, onClose: onClose, content: content) { EmptyView() }
    }
}

/// A pinned footer row under a hairline.
struct BrainSheetFooter<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
            content().padding(.horizontal, 20).padding(.vertical, 14)
        }
    }
}
