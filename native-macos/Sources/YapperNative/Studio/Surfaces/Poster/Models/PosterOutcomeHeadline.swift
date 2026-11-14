import Foundation

/// The one line above the outcome rows: what is going out, or how it went.
/// A failure outranks a wait, and a wait outranks a success, so the line
/// never reads as done while a destination still needs the creator.
struct PosterOutcomeHeadline: Equatable {
    enum Mark: Equatable { case sending, done, waiting, failed }

    let text: String
    let mark: Mark

    init?(rows: [PosterOutcomeRow]) {
        guard !rows.isEmpty else { return nil }
        let sending = rows.filter(\.isSending).map(\.platform)
        let outcomes = rows.compactMap(\.outcome)
        let failed = outcomes.filter { $0.status == .failed }.count
        let posted = outcomes.filter { $0.status == .posted }.map(\.platform)
        let drafted = outcomes.contains { $0.status == .draft }

        if !sending.isEmpty {
            text = "Publishing to \(Self.names(sending))…"
            mark = .sending
        } else if failed > 0 {
            text = rows.count == 1 ? "Couldn’t post to \(Self.names(rows.map(\.platform)))" : "\(failed) of \(rows.count) posts failed"
            mark = .failed
        } else if outcomes.contains(where: { $0.status == .pending }) {
            text = "Waiting for confirmation"
            mark = .waiting
        } else if !posted.isEmpty {
            text = "Posted to \(Self.names(posted))" + (drafted ? " and sent to your TikTok inbox" : "")
            mark = .done
        } else if drafted {
            text = "Sent to your TikTok inbox"
            mark = .done
        } else {
            text = "Scheduled"
            mark = .done
        }
    }

    /// "YouTube", "YouTube and TikTok", "YouTube, TikTok, and Instagram".
    private static func names(_ platforms: [PublishPlatform]) -> String {
        platforms.map(\.label).formatted(.list(type: .and).locale(Locale(identifier: "en_US")))
    }
}
