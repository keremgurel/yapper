import AppKit
import SwiftUI

/// Connect the platforms Yapper can post to. Connecting opens the platform's
/// own sign-in window; everything else happens in place.
struct ConnectionsPage: View {
    @ObservedObject var store: ConnectionsStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Connections",
                description: "Connect your accounts, prepare posts in Poster, and manage scheduled sending in Calendar."
            )
            if let error = store.error {
                NativeErrorState(message: error) { Task { await store.refresh() } }
                    .padding(.bottom, 16)
            }
            VStack(spacing: 0) {
                ForEach(Array(PublishPlatform.allCases.enumerated()), id: \.element) { index, platform in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                    ConnectionRow(platform: platform, store: store)
                }
            }
            .background(NativeCardBackground())
        }
        .task { await store.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task { await store.refresh() }
        }
    }
}

private struct ConnectionRow: View {
    let platform: PublishPlatform
    @ObservedObject var store: ConnectionsStore

    var body: some View {
        let connection = store.connection(for: platform)
        HStack(spacing: 14) {
            Image(systemName: platform.symbol)
                .font(.system(size: 17))
                .foregroundStyle(.secondary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(platform.label).font(.system(size: 14, weight: .semibold))
                Text(connection.map { $0.handle ?? "Connected" } ?? platform.postMeaning)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 12)
            trailing(connection)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }

    @ViewBuilder
    private func trailing(_ connection: ConnectionSummary?) -> some View {
        if let connection {
            HStack(spacing: 10) {
                if connection.status == "active" {
                    Label("Connected", systemImage: "checkmark")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(NativeChip.Tone.green.color)
                } else {
                    Text("Reconnect required").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                    if store.canConnect(platform) {
                        Button("Reconnect") { store.connect(platform) }
                            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    }
                }
                Button("Disconnect") { Task { await store.disconnect(platform) } }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .disabled(store.pending.contains(platform))
            }
        } else if store.loading {
            RoundedRectangle(cornerRadius: 7).fill(Color.studioFaintFill).frame(width: 80, height: 28)
        } else if store.canConnect(platform) {
            Button("Connect") { store.connect(platform) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        } else {
            Text("Coming soon").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
        }
    }
}
