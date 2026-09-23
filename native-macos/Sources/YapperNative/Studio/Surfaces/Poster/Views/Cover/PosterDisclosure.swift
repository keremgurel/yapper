import SwiftUI

/// A folded step: its title, a quiet state beside it, its body when open.
struct PosterDisclosure<Content: View>: View {
    let title: String
    var meta: String?
    @ViewBuilder var content: () -> Content
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.easeOut(duration: 0.15)) { open.toggle() } } label: {
                HStack(spacing: 8) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    if let meta { Text(meta).font(.system(size: 12)).foregroundStyle(.secondary) }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
            }
            .buttonStyle(.studioPlain)
            if open {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                content().padding(16)
            }
        }
        .background(NativeCardBackground(radius: 12))
    }
}
