import SwiftUI

/// A titled part of a panel that folds away, remembered per section across
/// launches. One shape for every section, so a panel reads as a list of
/// things you can open rather than a wall of controls.
struct InspectorFoldSection<Accessory: View, Content: View>: View {
    let title: String
    var summary: String?
    @AppStorage private var isOpen: Bool
    let accessory: Accessory
    let content: Content

    init(
        _ title: String,
        id: String,
        summary: String? = nil,
        openByDefault: Bool = true,
        @ViewBuilder accessory: () -> Accessory = { EmptyView() },
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.summary = summary
        _isOpen = AppStorage(wrappedValue: openByDefault, "inspectorFold.\(id)")
        self.accessory = accessory()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Button {
                    withAnimation(.easeOut(duration: 0.16)) { isOpen.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.studioTextMuted)
                            .rotationEffect(.degrees(isOpen ? 90 : 0))
                            .frame(width: 10)
                        Text(title).font(.studioBodyStrong)
                        if let summary, !isOpen {
                            Text(summary)
                                .font(.studioCaption)
                                .foregroundStyle(Color.studioTextMuted)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                .accessibilityLabel(title)
                .accessibilityValue(isOpen ? "Open" : "Folded")
                accessory
            }
            .frame(minHeight: 40)

            if isOpen {
                content
                    .padding(.bottom, 14)
                    .transition(.opacity)
            }
        }
    }
}
