import SwiftUI

/// Compact library navigation keeps real videos on the first screen.
struct PosterSourceOptions: View {
    let selected: PosterSource
    let connected: [PublishPlatform]
    let onChoose: (PosterSource) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
            choice(.yapper, title: "Made in Yapper", detail: "Latest edited projects", icon: "film.stack")
            choice(.uploads, title: "Uploads", detail: "Ready to post", icon: "square.and.arrow.up")
            ForEach(PublishPlatform.allCases) { platform in
                choice(.platform(platform), title: platform.label,
                       detail: connected.contains(platform) ? "Connected" : "Connect account", icon: platform.symbol)
            }
        }
    }

    private func choice(_ source: PosterSource, title: String, detail: String, icon: String) -> some View {
        Button { onChoose(source) } label: {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 17)).frame(width: 22)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    Text(detail).font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if selected == source { Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)) }
            }
            .padding(12).frame(maxWidth: .infinity, minHeight: 64)
            .background(RoundedRectangle(cornerRadius: 10).fill(selected == source ? Color.studioFaintFill : Color.clear))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(selected == source ? Color.primary.opacity(0.5) : Color.studioLine))
            .contentShape(Rectangle())
        }.buttonStyle(.studioPlain).accessibilityAddTraits(selected == source ? .isSelected : [])
    }
}
