import Foundation

protocol ProjectPersisting: Sendable {
    func load() async throws -> EditorProject?
    func save(_ project: EditorProject) async throws
    func takeRecoveryNotice() async -> String?
}

extension ProjectPersisting {
    func takeRecoveryNotice() async -> String? { nil }
}

actor ProjectStore: ProjectPersisting {
    static let shared = ProjectStore()

    private let directoryURL: URL
    private var pendingRecoveryNotice: String?

    init(directory: URL = ProjectStore.directory) {
        directoryURL = directory
    }

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

    /// Where the open project lives.
    ///
    /// Somewhere else entirely when the tests are running. An `EditorSession`
    /// loads the saved project the moment it is made and saves it again after
    /// almost any edit, so a test that makes one was reading and writing the
    /// creator's real work: one `swift test` away from a fabricated two-clip
    /// project being written over an afternoon's editing. Tests get their own
    /// file, per process, and are welcome to do whatever they like to it.
    private var projectURL: URL {
        directoryURL
            .appending(path: "CurrentProject.json", directoryHint: .notDirectory)
    }

    private var backupURL: URL {
        directoryURL
            .appending(path: "CurrentProject.backup.json", directoryHint: .notDirectory)
    }

    /// True while a test bundle is what is running. Read from the environment
    /// XCTest sets up rather than from a compile-time flag, because the app and
    /// the tests are built from the same target.
    static var isTesting: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["XCTestConfigurationFilePath"] != nil
            || environment["XCTestBundlePath"] != nil
            || environment["SWIFT_TESTING_ENABLED"] != nil
            || ProcessInfo.processInfo.arguments.contains { $0.hasSuffix(".xctest") }
    }

    static var directory: URL {
        guard !isTesting else {
            return FileManager.default.temporaryDirectory
                .appending(
                    path: "YapperNativeTests-\(ProcessInfo.processInfo.processIdentifier)",
                    directoryHint: .isDirectory
                )
        }
        let support = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0]
        return support.appending(path: "Yapper Studio Native", directoryHint: .isDirectory)
    }

    func load() async throws -> EditorProject? {
        pendingRecoveryNotice = nil
        var primaryFailure: Error?
        if FileManager.default.fileExists(atPath: projectURL.path) {
            do {
                return try decodeProject(at: projectURL).project
            } catch {
                primaryFailure = error
            }
        }

        guard FileManager.default.fileExists(atPath: backupURL.path) else {
            if let primaryFailure { throw primaryFailure }
            return nil
        }
        do {
            let recovered = try decodeProject(at: backupURL)
            // Repair is best-effort: the creator can still work from the valid
            // in-memory copy if the disk has become read-only or full.
            try? install(recovered.data, at: projectURL)
            pendingRecoveryNotice = "Recovered the project from its last known-good copy"
            return recovered.project
        } catch {
            // Prefer the primary error when both copies exist and are damaged;
            // it describes the file the app normally opens.
            throw primaryFailure ?? error
        }
    }

    func save(_ project: EditorProject) async throws {
        let directory = directoryURL
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let next = try encoder.encode(project)
        _ = try decoder.decode(EditorProject.self, from: next)

        // Only a decodable primary is allowed to become the backup. Corrupt
        // primary bytes must never overwrite the one copy known to be good.
        let backup = validData(at: projectURL)
            ?? validData(at: backupURL)
            ?? next
        try install(backup, at: backupURL)
        try install(next, at: projectURL)
    }

    func takeRecoveryNotice() async -> String? {
        defer { pendingRecoveryNotice = nil }
        return pendingRecoveryNotice
    }

    private func decodeProject(at url: URL) throws -> (project: EditorProject, data: Data) {
        let data = try Data(contentsOf: url)
        return (try decoder.decode(EditorProject.self, from: data), data)
    }

    private func validData(at url: URL) -> Data? {
        guard let decoded = try? decodeProject(at: url) else { return nil }
        return decoded.data
    }

    private func install(_ data: Data, at url: URL) throws {
        try data.write(to: url, options: .atomic)
    }
}
