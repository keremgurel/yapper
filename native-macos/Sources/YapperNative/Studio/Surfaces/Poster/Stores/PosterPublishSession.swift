import Foundation

/// One press of publish for the open video: every chosen destination at
/// once. Destinations run in parallel and fail independently, so an
/// Instagram error never blocks a YouTube upload. Keys are kept per
/// destination, so a retry checks the same attempt instead of sending a
/// second copy.
@MainActor
final class PosterPublishSession: ObservableObject {
    @Published private(set) var posting = false
    @Published private(set) var outcomes: [PosterOutcome] = []
    @Published var youtube = PosterYouTubeSettings()
    private var keys: [String: String] = [:]

    /// Marks the start of a press, before the video is prepared, so the
    /// whole column locks for the full send.
    func begin() -> Bool {
        guard !posting else { return false }
        posting = true
        return true
    }

    func end() { posting = false }

    func publish(_ target: PosterPublishTarget, to chosen: [PublishPlatform], tiktok: PosterTikTokReview?,
                 connections: PosterConnectionStore, drafts: PosterDraftStore) async {
        guard !chosen.isEmpty else { return }
        outcomes = []
        await withTaskGroup(of: PosterOutcome.self) { group in
            for platform in chosen {
                let key = attemptKey("\(target.id):\(platform.rawValue)")
                let youtube = youtube
                let account = connections.accountID(for: platform)
                group.addTask { await Self.send(target, platform, key: key, review: tiktok, youtube: youtube, account: account) }
            }
            for await outcome in group {
                outcomes.append(outcome)
                drafts.record(outcome)
            }
        }
        if outcomes.count == chosen.count, outcomes.allSatisfy({ $0.status == .posted || $0.status == .draft }),
           let id = target.contentItemID,
           PosterLibraryStore.shared.items?.first(where: { $0.id == id })?.sourceUrl == "yapper://poster-upload" {
            if let updated: PosterContentEnvelope = try? await PosterHTTP.patch("api/content/\(id)", body: ["sourceUrl": "yapper://poster-upload/completed"]) {
                PosterLibraryStore.shared.upsert(updated.item)
            }
        }
    }

    private func attemptKey(_ target: String) -> String {
        if let key = keys[target] { return key }
        let key = UUID().uuidString.lowercased()
        keys[target] = key
        return key
    }

    private nonisolated static func send(
        _ target: PosterPublishTarget, _ platform: PublishPlatform, key: String,
        review: PosterTikTokReview?, youtube: PosterYouTubeSettings, account: String?
    ) async -> PosterOutcome {
        do {
            let result = try await PosterPublishAPI.post(target, to: platform, key: key, tiktok: review, youtube: youtube, accountID: account)
            return PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform,
                                 status: result.draft == true ? .draft : .posted, url: result.url.flatMap(URL.init(string:)))
        } catch {
            let code = PosterPublishAPI.code(for: error, platform: platform)
            return PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform,
                                 status: code == "publish_in_progress" ? .pending : .failed, error: code)
        }
    }
}
