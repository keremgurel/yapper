import Foundation

typealias PosterHandoffRunner = @MainActor (
    URL,
    String,
    @escaping @MainActor (PosterHandoffStage) -> Void
) async throws -> String

/// What a job does: render the snapshot, and for Poster, hand the file over.
enum ExportJobWork {
    static func file(
        _ snapshot: ExportProjectSnapshot,
        to destination: URL,
        runner: @escaping NativeExportRunner
    ) -> ExportJobCenter.Work {
        { reporter in
            try await runner(snapshot.project, destination, reporter.renderedFromAnyThread)
            return .file(destination)
        }
    }

    /// The title comes from the snapshot, not the open project: by the time
    /// the upload starts the editor may be showing something else.
    static func poster(
        _ snapshot: ExportProjectSnapshot,
        to destination: URL,
        runner: @escaping NativeExportRunner,
        handoff: @escaping PosterHandoffRunner = { url, title, stage in
            try await PosterHandoffService.prepare(exportURL: url, title: title, stage: stage)
        }
    ) -> ExportJobCenter.Work {
        { reporter in
            try await runner(snapshot.project, destination, reporter.renderedFromAnyThread)
            try Task.checkCancellation()
            let itemID = try await handoff(destination, snapshot.projectName) { stage in
                reporter.posting(stage)
            }
            try Task.checkCancellation()
            return .poster(itemID: itemID)
        }
    }
}
