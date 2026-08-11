import Foundation

/// Delivers a completed file without exposing partial bytes or destroying an
/// existing destination when production, validation, or cancellation fails.
enum StagedFileDelivery {
    static func deliver(
        to destination: URL,
        fileManager: FileManager = .default,
        makeID: () -> UUID = UUID.init,
        produce: (URL) async throws -> Void,
        validate: (URL) async throws -> Void
    ) async throws {
        guard destination.isFileURL else {
            throw NativeEditorError.exportFailed("The export destination is not a file.")
        }

        let parent = destination.deletingLastPathComponent()
        let baseName = destination.deletingPathExtension().lastPathComponent
        let staged = parent.appending(
            path: ".\(baseName).yapper-export-\(makeID().uuidString).mp4"
        )
        defer {
            if fileManager.fileExists(atPath: staged.path) {
                try? fileManager.removeItem(at: staged)
            }
        }

        try Task.checkCancellation()
        try await produce(staged)
        try Task.checkCancellation()
        try await validate(staged)
        try Task.checkCancellation()

        var isDirectory: ObjCBool = false
        let destinationExists = fileManager.fileExists(
            atPath: destination.path,
            isDirectory: &isDirectory
        )
        if destinationExists {
            guard !isDirectory.boolValue else {
                throw NativeEditorError.exportFailed("The export destination is a folder.")
            }
            _ = try fileManager.replaceItemAt(
                destination,
                withItemAt: staged,
                backupItemName: nil,
                options: []
            )
        } else {
            try fileManager.moveItem(at: staged, to: destination)
        }
    }
}
