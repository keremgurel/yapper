import Foundation

/// Prepare saved edits locally. Upload only for an explicit publish request,
/// sharing each render and transfer across simultaneous requests.
@MainActor
final class PosterProjectSync: ObservableObject {
    static let shared = PosterProjectSync()
    @Published private(set) var status: [UUID: String] = [:]
    @Published private(set) var errors: [UUID: String] = [:]
    private var pending: [UUID: Task<Void, Never>] = [:]
    private var uploads: [String: Task<PosterContentItem, Error>] = [:]
    private var completed: [String: PosterContentItem] = [:]

    func schedule(_ listing: ProjectListing, delay: Double = 2) {
        guard !ProjectStore.isTesting, listing.summary.clipCount > 0 else { return }
        pending[listing.summary.id]?.cancel()
        pending[listing.summary.id] = Task {
            do {
                try await Task.sleep(for: .seconds(delay))
                guard await PosterProjectRender.shared.cached(listing) == nil else { return }
                let id = listing.summary.id
                status[id] = "Preparing latest edit…"
                errors[id] = nil
                defer { if status[id] == "Preparing latest edit…" { status[id] = nil } }
                _ = try await PosterProjectRender.shared.render(listing)
            } catch is CancellationError { }
            catch { errors[listing.summary.id] = error.localizedDescription }
        }
    }

    func prepare(_ listing: ProjectListing) async throws -> PosterContentItem {
        guard let userID = StudioAuth.shared.account?.userID else {
            throw NativeEditorError.exportFailed("Sign in to make this edit available for posting.")
        }
        let id = listing.summary.id
        guard let project = try await ProjectPackageStore(package: listing.package).load() else {
            throw PosterHandoffError.invalidExport
        }
        if let owner = project.studioSource?.userID, owner != userID {
            throw NativeEditorError.exportFailed("This project belongs to another Yapper account.")
        }
        let revision = try PosterProjectRender.revision(project)
        let key = "\(userID):\(id):\(revision)"
        if let task = uploads[key] { return try await task.value }
        // Validate a receipt before reuse: Storage may have deleted its file since
        // the library loaded. The attachment endpoint checks ownership and lifecycle.
        let saved = completed[key] ?? (PosterLibraryStore.shared.belongsToCurrentAccount
            ? PosterLibraryStore.shared.items?.first(where: {
                $0.sourceUrl == "yapper://project/\(id.uuidString.lowercased())" && $0.editorRevision == revision && $0.submissionId != nil
            }) : nil)
        if let submission = saved?.submissionId {
            do {
                let current = try await PosterProjectUpload.attach(submissionID: submission, project: project, revision: revision, userID: userID)
                completed[key] = current
                PosterLibraryStore.shared.upsert(current)
                return current
            } catch let error as PosterHTTPError where ["bad_submission", "media_unavailable"].contains(error.code) {
                completed[key] = nil
            }
        }
        errors[id] = nil
        status[id] = "Preparing latest edit…"
        let task = Task<PosterContentItem, Error> {
            defer { status[id] = nil }
            let file = try await PosterProjectRender.shared.render(listing)
            try Task.checkCancellation()
            guard file.deletingPathExtension().lastPathComponent == revision else {
                throw NativeEditorError.exportFailed("The edit changed while preparing. Select it again to use the latest version.")
            }
            guard let latest = try await ProjectPackageStore(package: listing.package).load(),
                  try PosterProjectRender.revision(latest) == revision else {
                throw NativeEditorError.exportFailed("The edit changed while preparing. Its latest version will be prepared after saving.")
            }
            status[id] = "Uploading latest edit…"
            let item = try await PosterProjectUpload.prepare(file, project: project, userID: userID) { progress in
                Task { @MainActor in self.status[id] = "Uploading latest edit, \(Int(progress * 100))%" }
            }
            completed[key] = item
            PosterLibraryStore.shared.upsert(item)
            return item
        }
        uploads[key] = task
        defer { uploads[key] = nil }
        return try await task.value
    }
}
