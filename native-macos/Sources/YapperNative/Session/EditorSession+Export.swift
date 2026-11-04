import Foundation

/// Starting an export and hearing back from it.
///
/// The editor only checks the project and captures it. The render belongs to
/// `exportJobs`, so once these return the creator can keep editing, open
/// another project, or start a second export.
extension EditorSession {
    /// Renders the open project to a file the creator chose.
    @discardableResult
    func export(to url: URL) async -> UUID? {
        await startExport(to: url, kind: .file)
    }

    /// Renders the open project to a temporary file and hands it to Poster.
    @discardableResult
    func exportForPosting(to url: URL) async -> UUID? {
        await startExport(to: url, kind: .poster)
    }

    private func startExport(to url: URL, kind: ExportJob.Kind) async -> UUID? {
        guard !project.clips.isEmpty else { return nil }
        if let busy = activeOperation {
            showMessage(busy.operation.waitMessage + " Then export.")
            return nil
        }
        guard !exportJobs.isExporting(to: url) else {
            showMessage("That file is still exporting. Choose another name.")
            return nil
        }
        guard let snapshot = await captureExportSnapshot() else { return nil }
        let work = switch kind {
        case .file: ExportJobWork.file(snapshot, to: url, runner: exportRunner)
        case .poster: ExportJobWork.poster(snapshot, to: url, runner: exportRunner)
        }
        let id = exportJobs.start(snapshot, kind: kind, to: url, work: work)
        clearError()
        showMessage("Exporting in the background")
        NativeAnalytics.shared.capture("native_export_started", [
            "operation_id": id.uuidString,
            "kind": kind.rawValue,
            "duration_seconds": snapshot.project.duration,
            "concurrent_exports": exportJobs.runningJobs.count,
        ])
        return id
    }

    /// The project as it stands, once every file an export needs is online
    /// and still the file it was imported as.
    private func captureExportSnapshot() async -> ExportProjectSnapshot? {
        guard await beginPreparedTimelineEdit() != nil else { return nil }
        defer { endPreparedTimelineEdit() }
        guard !Task.isCancelled else { return nil }
        repairBuiltInAudioURLs()
        mediaAvailability.refresh(notifyRestored: false)
        guard mediaAvailability.requiredOffline.isEmpty else {
            show(ExportStartError.offlineMedia)
            return nil
        }
        do {
            try await validateAvailableMediaIdentity()
        } catch {
            mediaAvailability.refresh(notifyRestored: false)
            show(error)
            return nil
        }
        return ExportProjectSnapshot(project: project, package: projectNavigation.currentPackage)
    }

    /// A job stopped. The indicator in the top bar shows every outcome; the
    /// editor only joins in when the creator is still on that project.
    func exportJobFinished(_ job: ExportJob) {
        let stillOpen = project.id == job.projectID
        NativeAnalytics.shared.capture(Self.analyticsEvent(for: job.state), [
            "operation_id": job.id.uuidString,
            "kind": job.kind.rawValue,
            "elapsed_seconds": Date().timeIntervalSince(job.startedAt),
            "project_still_open": stillOpen,
        ])
        guard stillOpen else { return }
        switch job.state {
        case let .finished(.file(url)):
            lastExportURL = url
            showMessage("Exported \(url.lastPathComponent)")
        case let .finished(.poster(itemID)):
            showMessage("Ready to write and cross-post")
            StudioWebCommands.shared.openPoster(itemID: itemID)
        case let .failed(message):
            show(ExportStartError.failed(message))
        case .canceled:
            showMessage(job.kind == .poster ? "Export and post canceled" : "Export canceled")
        case .preparing, .rendering, .posting:
            break
        }
    }

    private static func analyticsEvent(for state: ExportJobState) -> String {
        switch state {
        case .finished: "native_export_completed"
        case .canceled: "native_export_canceled"
        default: "native_export_failed"
        }
    }
}

private enum ExportStartError: LocalizedError {
    case offlineMedia
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .offlineMedia: "Reconnect the required offline media before exporting."
        case let .failed(message): message
        }
    }
}
