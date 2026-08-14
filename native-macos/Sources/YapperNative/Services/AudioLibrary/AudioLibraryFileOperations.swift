import Foundation

struct AudioLibraryFileOperations: @unchecked Sendable {
    var exists: (URL) -> Bool
    var move: (URL, URL) throws -> Void
    var remove: (URL) throws -> Void
    var contents: (URL) throws -> [URL]
    var isRegularFile: (URL) -> Bool

    static let live = AudioLibraryFileOperations(
        exists: { FileManager.default.fileExists(atPath: $0.path) },
        move: { try FileManager.default.moveItem(at: $0, to: $1) },
        remove: { try FileManager.default.removeItem(at: $0) },
        contents: {
            try FileManager.default.contentsOfDirectory(
                at: $0,
                includingPropertiesForKeys: [.isRegularFileKey]
            )
        },
        isRegularFile: {
            (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
        }
    )
}
