import Foundation

/// Which channels failed to load, read the way the web's `channel-health.ts`
/// reads them: one failing channel never hides the others' numbers.
enum HomeChannelHealth {
    static func failed(_ channels: [HomeChannel]?) -> [PublishPlatform] {
        (channels ?? []).filter(\.failed).map(\.platform)
    }

    /// True when nothing could be shown: every channel that should have data
    /// failed.
    static func allFailed(_ channels: [HomeChannel]?) -> Bool {
        let relevant = (channels ?? []).filter { $0.connected || $0.failed }
        return !relevant.isEmpty && relevant.allSatisfy(\.failed)
    }

    /// "Instagram", "Instagram and TikTok", "Instagram, TikTok and YouTube".
    static func names(_ platforms: [PublishPlatform]) -> String {
        let names = platforms.map(\.label)
        guard names.count > 1 else { return names.first ?? "" }
        return names.dropLast().joined(separator: ", ") + " and " + (names.last ?? "")
    }
}
