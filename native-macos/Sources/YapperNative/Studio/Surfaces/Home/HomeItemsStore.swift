import Foundation

/// The creator's content items, read twice the way the web Home does: the
/// Library queue for Up next and the Idea Bank for Five for today. A failed
/// read is kept apart from an empty list.
@MainActor
final class HomeItemsStore: ObservableObject {
    static let shared = HomeItemsStore()

    @Published private(set) var pipeline: [HomeItem]?
    @Published private(set) var ideas: [HomeItem]?
    @Published private(set) var pipelineFailed = false
    @Published private(set) var ideasFailed = false

    func refresh() async {
        async let content = Self.read("api/content")
        async let bank = Self.read("api/ideas")
        let (contentResult, bankResult) = await (content, bank)

        if let items = contentResult { pipeline = items }
        pipelineFailed = pipeline == nil && contentResult == nil
        if let items = bankResult { ideas = items }
        ideasFailed = ideas == nil && bankResult == nil
    }

    private nonisolated static func read(_ path: String) async -> [HomeItem]? {
        try? await StudioJSONClient.get(path, as: HomeItemsResponse.self).items
    }
}
