import Foundation

/// One press of publish for the open video: every chosen destination at
/// once. Destinations run in parallel and fail independently, so an
/// Instagram error never blocks a YouTube upload. Keys are kept per
/// destination, so a retry checks the same attempt instead of sending a
/// second copy.
@MainActor
final class PosterPublishSession: ObservableObject {
    @Published private(set) var posting = false
    /// The latest result for each destination sent from this page.
    @Published private(set) var outcomes: [PosterOutcome] = []
    /// Destinations on their way right now.
    @Published private(set) var inFlight: Set<PublishPlatform> = []
    @Published var youtube = PosterYouTubeSettings()
    /// Every destination sent from this page, so a row keeps its place.
    private var sent: Set<PublishPlatform> = []
    private var keys: [String: String] = [:]

    /// One line per destination sent, in platform order: still going out, or
    /// what happened.
    var rows: [PosterOutcomeRow] {
        PosterOutcomeRow.list(sent: sent, inFlight: inFlight, outcomes: outcomes)
    }

    /// Marks the start of a press, before the video is prepared, so the
    /// whole column locks for the full send. `destinations` are the ones
    /// going out now; a scheduled press passes none.
    func begin(sending destinations: [PublishPlatform] = []) -> Bool {
        guard !posting else { return false }
        posting = true
        track(destinations)
        return true
    }

    func end() {
        posting = false
        inFlight = []
    }

    func publish(_ target: PosterPublishTarget, to chosen: [PublishPlatform], tiktok: PosterTikTokReview?,
                 connections: PosterConnectionStore, drafts: PosterDraftStore) async {
        guard !chosen.isEmpty else { return }
        track(chosen)
        var landed: [PosterOutcome] = []
        await withTaskGroup(of: PosterOutcome.self) { group in
            for platform in chosen {
                let key = attemptKey("\(target.id):\(platform.rawValue)")
                let youtube = youtube
                let account = connections.accountID(for: platform)
                group.addTask { await Self.send(target, platform, key: key, review: tiktok, youtube: youtube, account: account) }
            }
            for await outcome in group {
                landed.append(outcome)
                land(outcome)
                drafts.record(outcome)
                if outcome.coverPending, let thumbnailKey = target.thumbnailKey {
                    finishCover(of: outcome, thumbnailKey: thumbnailKey,
                                key: attemptKey("\(target.id):\(outcome.platform.rawValue)"), drafts: drafts)
                }
            }
        }
        if landed.count == chosen.count, landed.allSatisfy({ $0.status == .posted || $0.status == .draft }),
           let id = target.contentItemID,
           PosterLibraryStore.shared.items?.first(where: { $0.id == id })?.sourceUrl == "yapper://poster-upload" {
            if let updated: PosterContentEnvelope = try? await PosterHTTP.patch("api/content/\(id)", body: ["sourceUrl": "yapper://poster-upload/completed"]) {
                PosterLibraryStore.shared.upsert(updated.item)
            }
        }
    }

    private func track(_ destinations: [PublishPlatform]) {
        sent.formUnion(destinations)
        inFlight.formUnion(destinations)
    }

    /// A destination's new result replaces its last one, so an earlier post
    /// stays listed while a failed one is sent again.
    private func land(_ outcome: PosterOutcome) {
        outcomes.removeAll { $0.platform == outcome.platform }
        outcomes.append(outcome)
        inFlight.remove(outcome.platform)
    }

    /// The cover is set after the post is already reported live, so a slow
    /// or refused cover never holds up the publish. Its answer is folded into
    /// the same outcome when it arrives.
    private func finishCover(of outcome: PosterOutcome, thumbnailKey: String, key: String, drafts: PosterDraftStore) {
        Task {
            let applied = await PosterPublishAPI.applyCover(thumbnailKey: thumbnailKey, key: key)
            guard let index = outcomes.firstIndex(where: { $0.id == outcome.id && $0.coverPending }) else { return }
            outcomes[index].coverPending = false
            outcomes[index].coverApplied = applied
            drafts.record(outcomes[index])
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
                                 status: result.draft == true ? .draft : .posted, url: result.url.flatMap(URL.init(string:)),
                                 coverApplied: result.coverApplied, profileURL: result.profileUrl.flatMap(URL.init(string:)),
                                 coverPending: result.coverPending == true)
        } catch {
            let code = PosterPublishAPI.code(for: error, platform: platform)
            return PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform,
                                 status: code == "publish_in_progress" ? .pending : .failed, error: code)
        }
    }
}
