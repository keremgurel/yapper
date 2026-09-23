import SwiftUI

/// A quiet fold under the writing: a clickable line that opens its content.
/// Closed by default, like the web's `<details>`.
struct IdeaCanvasFold<Content: View, Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing
    @ViewBuilder var content: () -> Content
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Button { withAnimation(.snappy(duration: 0.2)) { open.toggle() } } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .rotationEffect(.degrees(open ? 90 : 0))
                        Text(title)
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
                Spacer(minLength: 0)
                trailing()
            }
            if open { content() }
        }
    }
}

extension IdeaCanvasFold where Trailing == EmptyView {
    init(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.init(title: title, trailing: { EmptyView() }, content: content)
    }
}
