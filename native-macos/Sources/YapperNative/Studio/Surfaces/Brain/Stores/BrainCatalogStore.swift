import Foundation

/// The skill shelf. Read when the catalog sheet first opens, re-read after
/// every install because the install is what changes which button shows.
@MainActor
final class BrainCatalogStore: ObservableObject {
    static let shared = BrainCatalogStore()

    @Published private(set) var entries: [BrainCatalogEntry]?
    @Published private(set) var installing: String?
    @Published private(set) var failed = false

    var loading: Bool { entries == nil && !failed }

    /// Entries grouped by category, in the order the server lists them.
    var groups: [(category: String, entries: [BrainCatalogEntry])] {
        var order: [String] = []
        var byCategory: [String: [BrainCatalogEntry]] = [:]
        for entry in entries ?? [] {
            let key = entry.category.isEmpty ? "Other" : entry.category
            if byCategory[key] == nil { order.append(key) }
            byCategory[key, default: []].append(entry)
        }
        return order.map { ($0, byCategory[$0] ?? []) }
    }

    func load() async {
        do {
            let response: BrainCatalogResponse = try await StudioJSONClient.get("api/brain/catalog")
            entries = response.entries
            failed = false
        } catch {
            if entries == nil { entries = [] }
            failed = true
        }
    }

    /// Installs an entry and hands the new skill or block to its list.
    func install(_ entry: BrainCatalogEntry) async {
        installing = entry.slug
        failed = false
        defer { installing = nil }
        do {
            let response = try await Self.install(entry.slug)
            if let block = response.block { BrainBlocksStore.shared.insert(block) }
            await BrainSkillsStore.shared.refresh()
            BrainPreviewStore.shared.invalidate()
            await load()
        } catch {
            failed = true
        }
    }

    static func install(_ slug: String) async throws -> BrainInstallResponse {
        let encoded = slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? slug
        let data = try await StudioJSONClient.raw("api/brain/catalog/\(encoded)/install", method: "POST", body: nil)
        do {
            return try StudioJSONClient.decoder.decode(BrainInstallResponse.self, from: data)
        } catch {
            throw StudioAPIError(status: 200, code: "decode", message: "Studio sent something this version of the app can't read. Update the app and try again.")
        }
    }
}
