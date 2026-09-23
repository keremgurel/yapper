import SwiftUI

/// Where this video goes: every platform, chosen, available, or not
/// connected yet. A missing channel connects from right here.
struct PosterDestinationToggles: View {
    let chosen: Set<PublishPlatform>
    let connected: [PublishPlatform]
    let onToggle: (PublishPlatform) -> Void
    let onConnect: (PublishPlatform) -> Void

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(PublishPlatform.allCases) { platform in
                if connected.contains(platform) {
                    toggle(platform)
                } else {
                    Button { onConnect(platform) } label: {
                        Label("Connect \(platform.label)", systemImage: "link")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground))
                    }
                    .buttonStyle(.studioPlain)
                }
            }
        }
    }

    private func toggle(_ platform: PublishPlatform) -> some View {
        let on = chosen.contains(platform)
        return Button { onToggle(platform) } label: {
            HStack(spacing: 6) {
                Image(systemName: on ? "checkmark" : platform.symbol)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(on ? Color.yapperOrange : Color.secondary)
                Text(platform.label).font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(on ? Color.primary : Color.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(on ? Color.panelBackground : Color.clear))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(on ? Color.yapperOrange : Color.studioLine, lineWidth: 1)
            )
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
