import Foundation

/// The creator's own audio, kept between projects.
///
/// One store for the whole app: the library page and the editor's sound shelf
/// are two views of the same folder, and a sound imported in one has to be on
/// the other's shelf immediately.
///
/// Everything is local. A saved sound is a copy in Application Support, which
/// makes importing instant and free and means the library does not follow the
/// account to another Mac. That is the trade taken deliberately: waiting on an
/// upload to hear a whoosh is worse than the library being per-machine.
@MainActor
final class AudioLibraryStore: ObservableObject {
    static let shared = AudioLibraryStore()

    @Published private(set) var items: [SavedAudio] = []
    /// Saved sounds whose file is no longer on disk, deleted from Finder or
    /// lost with a restored machine. Shown as missing rather than quietly
    /// dropped, because the creator is the only one who knows whether the file
    /// is coming back.
    @Published private(set) var missingIDs: Set<UUID> = []
    /// The file being imported right now, so a 40MB bed can say so.
    @Published private(set) var importingName: String?
    @Published var errorMessage: String?

    private let importer = AudioLibraryImporter.shared
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init() {
        load()
    }

    /// Everything of one kind, newest first: the sound just imported is the one
    /// being looked for.
    func items(of kind: SavedAudioKind) -> [SavedAudio] {
        items.filter { $0.kind == kind }.sorted { $0.addedAt > $1.addedAt }
    }

    func url(for item: SavedAudio) -> URL {
        AudioLibraryFolder.url(for: item)
    }

    /// Copies files into the library, skipping any already saved.
    /// - Returns: what was added, for a page that wants to select it.
    @discardableResult
    func add(_ urls: [URL]) async -> [SavedAudio] {
        var added: [SavedAudio] = []
        for url in urls {
            importingName = url.lastPathComponent
            do {
                let taken = Set(items.map(\.fileName.localizedLowercase))
                let hashes = Set(items.map(\.contentHash))
                if let item = try await importer.importFile(
                    at: url,
                    taken: taken,
                    existingHashes: hashes
                ) {
                    items.append(item)
                    added.append(item)
                }
            } catch let failure as AudioLibraryImporter.Failure {
                errorMessage = failure.reason
            } catch {
                errorMessage = error.localizedDescription
            }
        }
        importingName = nil
        if !added.isEmpty { save() }
        return added
    }

    func rename(_ id: UUID, to name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = items.firstIndex(where: { $0.id == id }) else { return }
        guard items[index].name != trimmed else { return }
        items[index].name = trimmed
        save()
    }

    func setKind(_ kind: SavedAudioKind, for id: UUID) {
        guard let index = items.firstIndex(where: { $0.id == id }), items[index].kind != kind else {
            return
        }
        items[index].kind = kind
        save()
    }

    /// Removes the entry and the copy it owns. The file the creator imported
    /// from is never touched.
    func remove(_ id: UUID) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        let item = items.remove(at: index)
        missingIDs.remove(id)
        try? FileManager.default.removeItem(at: AudioLibraryFolder.url(for: item))
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: AudioLibraryFolder.indexURL) else { return }
        guard let index = try? decoder.decode(AudioLibraryIndex.self, from: data) else {
            // A library nobody can read is worse left in place than reported:
            // the next import would write over it.
            errorMessage = "Your audio library could not be read. Nothing was changed."
            return
        }
        items = index.items
        missingIDs = Set(
            index.items
                .filter { !FileManager.default.fileExists(atPath: AudioLibraryFolder.url(for: $0).path) }
                .map(\.id)
        )
    }

    private func save() {
        AudioLibraryFolder.ensureExists()
        do {
            let data = try encoder.encode(AudioLibraryIndex(items: items))
            try data.write(to: AudioLibraryFolder.indexURL, options: .atomic)
        } catch {
            errorMessage = "Your audio library could not be saved: \(error.localizedDescription)"
        }
    }
}
