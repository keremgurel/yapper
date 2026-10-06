import SwiftUI

/// Compact library navigation keeps real videos on the first screen.
struct PosterSourceOptions: View {
    let selected: PosterSource
    let connected: [PublishPlatform]
    let onChoose: (PosterSource) -> Void
    @State private var availableWidth: CGFloat = 1_200

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: min(6, max(1, Int(availableWidth / 200)))), spacing: 8) {
            choice(.yapper, title: "Made in Yapper", detail: "Latest edited projects", icon: "film.stack")
            choice(.uploads, title: "Uploads", detail: "Ready to post", icon: "square.and.arrow.up")
            ForEach(PublishPlatform.allCases) { platform in
                choice(.platform(platform), title: platform.label,
                       detail: connected.contains(platform) ? "Connected" : "Connect account", icon: platform.symbol)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { availableWidth = $0 }
    }

    private func choice(_ source: PosterSource, title: String, detail: String, icon: String) -> some View {
        Button { onChoose(source) } label: {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 17)).frame(width: 22)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    Text(detail).font(.system(size: 11)).foregroundStyle(.secondary)
                }.lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)).opacity(selected == source ? 1 : 0)
            }
            .padding(12).frame(maxWidth: .infinity).frame(height: 64)
            .background(RoundedRectangle(cornerRadius: 10).fill(selected == source ? Color.studioFaintFill : Color.clear))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(selected == source ? Color.primary.opacity(0.5) : Color.studioLine))
            .contentShape(Rectangle())
        }.buttonStyle(.studioPlain).accessibilityAddTraits(selected == source ? .isSelected : [])
    }
}
