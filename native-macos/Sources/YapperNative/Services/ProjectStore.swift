import Foundation

actor ProjectStore {
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

    private var projectURL: URL {
        let support = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0]
        return support
            .appending(path: "Yapper Studio Native", directoryHint: .isDirectory)
            .appending(path: "CurrentProject.json", directoryHint: .notDirectory)
    }

    func load() throws -> EditorProject? {
        guard FileManager.default.fileExists(atPath: projectURL.path) else {
            return nil
        }
        return try decoder.decode(EditorProject.self, from: Data(contentsOf: projectURL))
    }

    func save(_ project: EditorProject) throws {
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
