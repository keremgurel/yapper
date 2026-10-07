import Foundation

extension EditorSession {
    func saveMediaInBackground() {
        guard !ProjectStore.isTesting, managedMediaTask == nil,
              let package = projectNavigation.currentPackage else { return }
        let pending = ManagedProjectMedia.sources(in: project, package: package)
            .filter { ManagedProjectMedia.resolved($0, in: package) == nil && !managedMediaFailures.contains($0.url) }
        guard !pending.isEmpty else { return }
        let projectID = project.id
        managedMediaPackage = package
        managedMediaTask = Task { [weak self] in
            guard let self else { return }
            for (index, source) in pending.enumerated() {
                if Task.isCancelled { break }
                if project.id == projectID { managedMediaStatus = "Saving \(package.displayName) to Yapper, \(index + 1) of \(pending.count). Keep the source connected." }
                do {
                    try await ManagedProjectMedia.copy(source, into: package)
                    try Task.checkCancellation()
                    // Copies keep running when another project opens. Its next
                    // load resolves the receipts without rewriting a stale edit.
                    if project.id == projectID, projectNavigation.currentPackage == package {
                        try await adoptManagedMedia(in: package, projectID: projectID)
                    }
                } catch is CancellationError { break }
                catch {
                    if project.id == projectID {
                        managedMediaFailures.insert(source.url)
                        managedMediaError = "Couldn’t save \(source.url.lastPathComponent) for \(package.displayName). \(error.localizedDescription)"
                        managedMediaStatus = managedMediaError
                    }
                }
            }
            managedMediaTask = nil
            managedMediaPackage = nil
            if project.id == projectID { managedMediaStatus = managedMediaError }
            projectNavigation.noteLibraryChanged()
            // An import may have arrived while a previous copy was running.
            if !Task.isCancelled { saveMediaInBackground() }
        }
    }

    func retryManagedMedia() {
        guard managedMediaTask == nil else { return }
        managedMediaFailures.removeAll()
        managedMediaError = nil
        managedMediaStatus = nil
        Task {
            if let package = projectNavigation.currentPackage {
                do { try await adoptManagedMedia(in: package, projectID: project.id) }
                catch {
                    managedMediaError = error.localizedDescription
                    managedMediaStatus = managedMediaError
                }
            }
            saveMediaInBackground()
        }
    }

    func stopManagedMedia(for package: ProjectPackage? = nil) async {
        if let package, managedMediaPackage != package { return }
        managedMediaTask?.cancel()
        await managedMediaTask?.value
        managedMediaTask = nil
        managedMediaPackage = nil
        managedMediaFailures.removeAll()
        managedMediaError = nil
        managedMediaStatus = nil
    }
}
