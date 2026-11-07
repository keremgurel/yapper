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
        // Claimed before the capture awaits, so a second export to this file
        // cannot start in the meantime.
        guard exportJobs.reserve(url) else {
            showMessage("That file is still exporting. Choose another name.")
            return nil
        }
        guard let snapshot = await captureExportSnapshot(of: exportOrigin) else {
            exportJobs.releaseReservation(url)
            return nil
        }
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
    ///
    /// Waiting for the edit slot and checking the media both await, and
    /// opening, creating or renaming a project does not take the edit slot.
    /// Each await is followed by a check that the export is still about the
    /// project it was asked for, so it never renders whatever opened next.
    private func captureExportSnapshot(of origin: ExportOrigin) async -> ExportProjectSnapshot? {
        guard await beginPreparedTimelineEdit() != nil else { return nil }
        defer { endPreparedTimelineEdit() }
        guard !Task.isCancelled, isStill(origin) else { return nil }
        repairBuiltInAudioURLs()
        mediaAvailability.refresh(notifyRestored: false)
        guard mediaAvailability.requiredOffline.isEmpty else {
            show(ExportStartError.offlineMedia)
            return nil
        }
        do {
            try await validateAvailableMediaIdentity()
        } catch {
            guard isStill(origin) else { return nil }
            mediaAvailability.refresh(notifyRestored: false)
            show(error)
            return nil
        }
        guard isStill(origin) else { return nil }
        return ExportProjectSnapshot(project: project, package: projectNavigation.currentPackage)
    }

    /// Which project an export was asked for: the open one, where it lives.
    struct ExportOrigin: Equatable {
        let projectID: UUID
        let package: ProjectPackage?
    }

    private var exportOrigin: ExportOrigin {
        ExportOrigin(projectID: project.id, package: projectNavigation.currentPackage)
    }

    private func isStill(_ origin: ExportOrigin) -> Bool {
        guard exportOrigin == origin else {
            showMessage("Nothing was exported because the project changed while the export was starting. Export again.")
            return false
        }
        return true
    }

    /// Refuses, with `refusal` on the status line, while an export is still
    /// copying this project's footage. Moving its package then would take the
    /// files out from under the copy.
    func refusesWhileExportReadsFootage(of projectID: UUID?, _ refusal: String) -> Bool {
        guard let projectID, exportJobs.isReadingSources(projectID: projectID) else { return false }
        showMessage(refusal)
        return true
    }

    static let renameRefusal = "Wait for the export to finish preparing this project’s footage before renaming it."
    static let trashRefusal = "Wait for the export to finish preparing this project’s footage before moving it to Trash."

    /// The project inside a package: the open one without reading the disk.
    func projectID(in package: ProjectPackage) async -> UUID? {
        if projectNavigation.currentPackage == package { return project.id }
        return await library.summary(for: package)?.id
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
