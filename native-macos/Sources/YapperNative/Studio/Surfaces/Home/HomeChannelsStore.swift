import Foundation

/// Every platform's own posts, read in parallel. One platform failing never
/// hides the others; it is kept as a failed channel so the page can say so.
@MainActor
final class HomeChannelsStore: ObservableObject {
    static let shared = HomeChannelsStore()

    /// Nil until the first read finishes; cached afterwards.
    @Published private(set) var channels: [HomeChannel]?

    var anyFailed: Bool { channels?.contains(where: \.failed) ?? false }

    private var loadedAt: Date?

    /// Re-reads unless the last read is younger than `maxAge`. Platform lists
    /// are slow and rate limited, so a window regaining focus does not
    /// refetch them every time (the web caches them for a minute too).
    func refresh(maxAge: TimeInterval = 0) async {
        if let loadedAt, Date().timeIntervalSince(loadedAt) < maxAge { return }
        loadedAt = Date()
        channels = await withTaskGroup(of: HomeChannel.self) { group in
            for platform in PublishPlatform.allCases {
                group.addTask { await Self.load(platform) }
            }
            var loaded: [HomeChannel] = []
            for await channel in group { loaded.append(channel) }
            return PublishPlatform.allCases.compactMap { platform in loaded.first { $0.platform == platform } }
        }
    }

    private nonisolated static func load(_ platform: PublishPlatform) async -> HomeChannel {
        do {
            let response: HomeVideosResponse = try await StudioJSONClient.get("api/publish/\(platform.rawValue)/videos")
            return HomeChannel(platform: platform, connected: response.connected, videos: response.videos, failed: false)
        } catch {
            return HomeChannel(platform: platform, connected: false, videos: [], failed: true)
        }
    }
}
