import AppKit
import Foundation
import UniformTypeIdentifiers

/// The Instagram import flow: pick the export, choose collections, import.
/// The archive is read on this Mac; only the chosen post links are sent.
@MainActor
final class InstagramImportModel: ObservableObject {
    struct CollectionCount: Equatable {
        var total = 0
        var newItems = 0
    }

    @Published private(set) var reading = false
    @Published private(set) var importing = false
    @Published private(set) var error: String?
    @Published private(set) var filename: String?
    @Published private(set) var entries: [InstagramSavedEntry] = []
    @Published var selected: Set<String> = []
    @Published private(set) var result: (imported: Int, skipped: Int)?

    private let store = IdeasStore.shared

    private var existing: Set<String> { Set(store.sourceURLs.map(InspoURL.normalize)) }

    var collections: [(name: String, count: CollectionCount)] {
        let known = existing
        var grouped: [String: CollectionCount] = [:]
        for entry in entries {
            grouped[entry.collection, default: CollectionCount()].total += 1
            if !known.contains(InspoURL.normalize(entry.url)) { grouped[entry.collection]!.newItems += 1 }
        }
        return grouped.keys.sorted().map { ($0, grouped[$0]!) }
    }

    var importable: [InstagramSavedEntry] {
        let known = existing
        return entries.filter { selected.contains($0.collection) && !known.contains(InspoURL.normalize($0.url)) }
    }

    var duplicateCount: Int {
        let known = existing
        return entries.filter { known.contains(InspoURL.normalize($0.url)) }.count
    }

    func choose() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.zip, .json, .html]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.message = "Choose the ZIP, JSON, or HTML file from your Instagram export."
        guard panel.runModal() == .OK, let url = panel.url else { return }
        load(url)
    }

    func load(_ url: URL) {
        reading = true
        error = nil
        result = nil
        Task {
            defer { reading = false }
            do {
                let documents = try await Task.detached { try InstagramArchiveReader.read(url) }.value
                let parsed = InstagramSavedParser.parse(files: documents)
                guard !parsed.isEmpty else { throw InstagramArchiveReader.Failure.noSaves }
                filename = url.lastPathComponent
                entries = parsed
                selected = Set(parsed.map(\.collection))
            } catch {
                self.error = (error as? InstagramArchiveReader.Failure ?? .readFailed).message
            }
        }
    }

    func toggle(_ name: String) {
        if selected.contains(name) { selected.remove(name) } else { selected.insert(name) }
    }

    func toggleAll() {
        let names = collections.map(\.name)
        selected = selected.count == names.count ? [] : Set(names)
    }

    func commit() {
        let batch = importable
        let skipped = entries.filter { selected.contains($0.collection) }.count - batch.count
        guard !batch.isEmpty, !importing else { return }
        importing = true
        error = nil
        Task {
            defer { importing = false }
            do {
                let body = InstagramImportRequest(entries: batch.map {
                    .init(url: $0.url, title: $0.title, savedAt: $0.savedAt)
                })
                let reply: ImportResponse = try await StudioJSONClient.post("api/ideas/import", body: body)
                // The server owns de-duplication, so it owns the resulting list.
                if reply.imported > 0 { await store.refresh() }
                result = (reply.imported, skipped)
            } catch {
                self.error = "The import didn't go through. Nothing was added; try again."
            }
        }
    }

    func reset() {
        error = nil
        filename = nil
        entries = []
        selected = []
        result = nil
    }
}

/// The body of `POST /api/ideas/import`.
struct InstagramImportRequest: Encodable {
    struct Entry: Encodable {
        let url: String
        let title: String?
        let savedAt: Double?
    }
    let entries: [Entry]
}
