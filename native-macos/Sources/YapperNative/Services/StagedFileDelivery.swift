import Foundation

/// Delivers a completed file without exposing partial bytes or destroying an
/// existing destination when production, validation, or cancellation fails.
enum StagedFileDelivery {
    static func deliver(
        to destination: URL,
        fileManager: FileManager = .default,
        ledger: StagedExportLedger = .shared,
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
        // Remembered until it is gone, so a launch after a crash can delete it.
        ledger.record(staged)
        defer {
            if fileManager.fileExists(atPath: staged.path) {
                try? fileManager.removeItem(at: staged)
            }
            ledger.forget(staged)
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
