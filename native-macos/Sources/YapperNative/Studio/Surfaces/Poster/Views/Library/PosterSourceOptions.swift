import SwiftUI

struct PosterSourceOptions: View {
    let selected: PosterSource
    let connected: [PublishPlatform]
    let uploadBusy: Bool
    let onUpload: () -> Void
    let onChoose: (PosterSource) -> Void
    @State private var availableWidth: CGFloat = 896

    private let platforms: [PublishPlatform] = [.instagram, .youtube, .tiktok]
    private var columnCount: Int { availableWidth >= 680 ? 5 : 3 }

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columnCount), spacing: 8) {
            choice("Upload video", detail: "From device", selected: false, action: onUpload)
                .disabled(uploadBusy)
            ForEach(platforms) { platform in
                let linked = connected.contains(platform)
                choice(platform.label, detail: linked ? "Connected" : "Connect",
                       selected: selected == .platform(platform), muted: !linked) { onChoose(.platform(platform)) }
            }
            choice("Made in Yapper", detail: "Edited projects", selected: selected == .yapper) { onChoose(.yapper) }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { availableWidth = $0 }
    }

    private func choice(_ title: String, detail: String, selected: Bool, muted: Bool = false,
                        action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(muted ? .secondary : .primary)
                Text(detail).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            .lineLimit(1)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 68)
            .background(RoundedRectangle(cornerRadius: 8).fill(selected || muted ? Color.studioInputBackground : Color.panelBackground))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(selected ? Color.yapperOrange : Color.studioLine))
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
