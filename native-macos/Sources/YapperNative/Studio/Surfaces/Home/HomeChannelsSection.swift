import SwiftUI

/// One row per publishing platform: identity, that channel's own numbers,
/// and whether it is connected. Totals live in the performance band.
struct HomeChannelsSection: View {
    let channels: [HomeChannel]?
    let connections: [ConnectionSummary]?
    let connectionsLoading: Bool
    let connectionsUnavailable: Bool

    var body: some View {
        NativeSection(title: "Channels") {
            Button("Manage") { StudioNavigation.shared.goTo(.connections) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        } content: {
            VStack(spacing: 0) {
                ForEach(Array(PublishPlatform.allCases.enumerated()), id: \.element) { index, platform in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                    row(platform)
                }
            }
            .background(NativeCardBackground(radius: 12))
        }
    }

    private func row(_ platform: PublishPlatform) -> some View {
        let channel = channels?.first { $0.platform == platform }
        let handle = connections?.first { $0.platform == platform.rawValue && $0.status == "active" }?.handle
        let connected = HomeRanking.isConnected(platform, channels: channels, connections: connections)
        return HStack(spacing: 12) {
            Image(systemName: platform.symbol)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .frame(width: 34, height: 34)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioFaintFill))
            VStack(alignment: .leading, spacing: 2) {
                Text(platform.label).font(.system(size: 13, weight: .medium))
                Text(handle ?? (connected ? "Account connected" : "Connect to load performance"))
                    .font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            trailing(channel: channel, connected: connected)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 56)
    }

    @ViewBuilder
    private func trailing(channel: HomeChannel?, connected: Bool) -> some View {
        if channels == nil || connectionsLoading {
            RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: 96, height: 16)
        } else if connectionsUnavailable || channel?.failed == true {
            NativeChip(text: "Couldn't load")
        } else {
            if connected, let channel {
                ViewThatFits {
                    Text("\(HomeNumber.compact(channel.totalViews)) views · \(HomeNumber.compact(channel.videos.count)) posts")
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    EmptyView()
                }
            }
            NativeChip(text: connected ? "Connected" : "Not connected", tone: connected ? .green : .neutral)
        }
    }
}
