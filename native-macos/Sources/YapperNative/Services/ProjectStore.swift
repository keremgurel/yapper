import Foundation

protocol ProjectPersisting: Sendable {
    func load() async throws -> EditorProject?
    func save(_ project: EditorProject) async throws
}

actor ProjectStore: ProjectPersisting {
    static let shared = ProjectStore()

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
        Self.directory
            .appending(path: "CurrentProject.json", directoryHint: .notDirectory)
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
        guard FileManager.default.fileExists(atPath: projectURL.path) else {
            return nil
        }
        return try decoder.decode(EditorProject.self, from: Data(contentsOf: projectURL))
    }

    func save(_ project: EditorProject) async throws {
        let directory = projectURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let temporary = directory.appending(path: "CurrentProject.next.json")
        try encoder.encode(project).write(to: temporary, options: .atomic)
        if FileManager.default.fileExists(atPath: projectURL.path) {
            _ = try FileManager.default.replaceItemAt(projectURL, withItemAt: temporary)
        } else {
            try FileManager.default.moveItem(at: temporary, to: projectURL)
        }
    }
}
