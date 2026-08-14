import Foundation

protocol AudioLibraryManifestPersisting {
    func load() throws -> AudioLibraryIndex?
    func save(_ index: AudioLibraryIndex) throws
}

enum AudioLibraryValidation {
    struct Invalid: Error {}

    static func validate(_ index: AudioLibraryIndex) throws {
        guard index.version > 0, index.version <= AudioLibraryIndex.currentVersion else {
            throw Invalid()
        }
        var ids = Set<UUID>()
        var names = Set<String>()
        for item in index.items {
            try validate(item)
            guard ids.insert(item.id).inserted,
                  names.insert(normalized(item.fileName)).inserted
            else { throw Invalid() }
        }
    }

    static func validate(_ candidate: AudioLibraryImportCandidate) throws {
        try validate(candidate.item)
        guard isSafeLeaf(candidate.stagedFileName, inside: AudioLibraryFolder.stagingDirectory)
        else { throw Invalid() }
    }

    private static func validate(_ item: SavedAudio) throws {
        guard isSafeLeaf(item.fileName, inside: AudioLibraryFolder.directory),
              item.duration.isFinite, item.duration > 0,
              !item.contentHash.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw Invalid() }
    }

    private static func normalized(_ name: String) -> String {
        name.precomposedStringWithCanonicalMapping.lowercased()
    }

    private static func isSafeLeaf(_ name: String, inside directory: URL) -> Bool {
        guard !name.isEmpty, name != ".", name != "..", URL(filePath: name).lastPathComponent == name
        else { return false }
        let resolvedDirectory = directory.standardizedFileURL.resolvingSymlinksInPath()
        let resolved = directory.appending(path: name).standardizedFileURL.resolvingSymlinksInPath()
        return resolved.deletingLastPathComponent() == resolvedDirectory
    }
}

struct AudioLibraryImportCandidate: Codable, Equatable, Sendable {
    let item: SavedAudio
    let stagedFileName: String
}

protocol AudioLibraryCandidatePersisting: Sendable {
    func load() throws -> AudioLibraryImportCandidate?
    func save(_ candidate: AudioLibraryImportCandidate) throws
    func clear() throws
}

struct AudioLibraryCandidateStore: AudioLibraryCandidatePersisting {
    func load() throws -> AudioLibraryImportCandidate? {
        guard FileManager.default.fileExists(atPath: AudioLibraryFolder.importCandidateURL.path) else {
            return nil
        }
        let candidate = try JSONDecoder().decode(
            AudioLibraryImportCandidate.self,
            from: Data(contentsOf: AudioLibraryFolder.importCandidateURL)
        )
        try AudioLibraryValidation.validate(candidate)
        return candidate
    }

    func save(_ candidate: AudioLibraryImportCandidate) throws {
        try AudioLibraryValidation.validate(candidate)
        AudioLibraryFolder.ensureTransactionDirectories()
        try JSONEncoder().encode(candidate).write(
            to: AudioLibraryFolder.importCandidateURL,
            options: .atomic
        )
    }

    func clear() throws {
        guard FileManager.default.fileExists(atPath: AudioLibraryFolder.importCandidateURL.path) else {
            return
        }
        try FileManager.default.removeItem(at: AudioLibraryFolder.importCandidateURL)
    }
}

struct AudioLibraryManifestStore: AudioLibraryManifestPersisting {
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

    func load() throws -> AudioLibraryIndex? {
        guard FileManager.default.fileExists(atPath: AudioLibraryFolder.indexURL.path) else {
            return nil
        }
        let index = try decoder.decode(
            AudioLibraryIndex.self,
            from: Data(contentsOf: AudioLibraryFolder.indexURL)
        )
        try AudioLibraryValidation.validate(index)
        return index
    }

    func save(_ index: AudioLibraryIndex) throws {
        try AudioLibraryValidation.validate(index)
        AudioLibraryFolder.ensureTransactionDirectories()
        try encoder.encode(index).write(to: AudioLibraryFolder.indexURL, options: .atomic)
    }
}
