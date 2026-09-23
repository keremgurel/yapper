import Foundation

/// One press of publish: every chosen video to every chosen destination.
/// Videos go one at a time so a batch never holds several large uploads;
/// each video's destinations run in parallel and fail independently, so an
/// Instagram error never blocks a YouTube upload. Keys are kept per target,
/// so a retry checks the same attempt instead of sending a second copy.
@MainActor
final class PosterPublishSession: ObservableObject {
    let targets: [PosterPublishTarget]
    @Published var selected: Set<PublishPlatform>
    @Published private(set) var posting = false
    @Published private(set) var outcomes: [PosterOutcome] = []
    @Published var scheduled = false
    @Published var scheduling = false
    @Published var tiktokReviews: [String: PosterTikTokReview] = [:]
    private var keys: [String: String] = [:]

    init(_ request: PosterPublishSheetRequest) {
        targets = request.targets
        selected = request.platforms
    }

    func chosen(from publishable: [PublishPlatform]) -> [PublishPlatform] {
        publishable.filter { selected.contains($0) }
    }

    func toggle(_ platform: PublishPlatform) {
        if selected.contains(platform) { selected.remove(platform) } else { selected.insert(platform) }
    }

    func tiktokReady(_ chosen: [PublishPlatform]) -> Bool {
        !chosen.contains(.tiktok) || targets.allSatisfy { tiktokReviews[$0.id]?.ready == true }
    }

    func done(_ chosen: [PublishPlatform]) -> Bool {
        !outcomes.isEmpty && outcomes.count == targets.count * chosen.count
    }

    var failures: Int { outcomes.filter { $0.status == .failed }.count }

    func publish(to chosen: [PublishPlatform], connections: PosterConnectionStore, drafts: PosterDraftStore) async {
        guard !posting, !scheduled, !targets.isEmpty, !chosen.isEmpty, tiktokReady(chosen) else { return }
        posting = true
        outcomes = []
        defer { posting = false }
        for target in targets {
            let results = await withTaskGroup(of: PosterOutcome.self) { group in
                for platform in chosen {
                    let key = attemptKey("\(target.id):\(platform.rawValue)")
                    let review = tiktokReviews[target.id]
                    let account = connections.accountID(for: platform)
                    group.addTask { await Self.send(target, platform, key: key, review: review, account: account) }
                }
                var collected: [PosterOutcome] = []
                for await outcome in group { collected.append(outcome) }
                return chosen.compactMap { platform in collected.first { $0.platform == platform } }
            }
            outcomes.append(contentsOf: results)
            results.forEach(drafts.record)
        }
    }

    private func attemptKey(_ target: String) -> String {
        if let key = keys[target] { return key }
        let key = UUID().uuidString.lowercased()
        keys[target] = key
        return key
    }

    private nonisolated static func send(
        _ target: PosterPublishTarget, _ platform: PublishPlatform, key: String, review: PosterTikTokReview?, account: String?
    ) async -> PosterOutcome {
        do {
            let result = try await PosterPublishAPI.post(target, to: platform, key: key, tiktok: review, accountID: account)
            return PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform,
                                 status: result.draft == true ? .draft : .posted, url: result.url.flatMap(URL.init(string:)))
        } catch {
            let code = PosterPublishAPI.code(for: error, platform: platform)
            return PosterOutcome(videoID: target.id, videoTitle: target.title, platform: platform,
                                 status: code == "publish_in_progress" ? .pending : .failed, error: code)
        }
    }
}
