import Foundation

/// Every project the creator has, in one folder they can see in Finder.
///
/// The folder is the one chosen for editor projects in Storage, by default
/// `~/Movies/Yapper Projects`. Nothing here talks to the network: a project
/// is a folder, listing is reading the folder, and deleting is the Trash, so a
/// mistake is undoable the way any file mistake is.
actor ProjectLibrary {
    static let shared = ProjectLibrary()

    /// Set for a library pinned to one folder; nil follows the Storage choice,
    /// so changing it takes effect on the next read without a new library.
    private nonisolated let pinnedDirectory: URL?
    private nonisolated let folders: StorageFolders

    nonisolated var directory: URL { pinnedDirectory ?? folders.folder(for: .editorProjects) }

    init(directory: URL? = nil, folders: StorageFolders = .standard) {
        self.pinnedDirectory = directory
        self.folders = folders
    }

    /// Newest edited first. A package whose summary can't be read isn't
    /// listed; `packages()` still finds it.
    func listings() throws -> [ProjectListing] {
        var listings: [ProjectListing] = []
        for package in try packages() {
            if let summary = summary(for: package) {
                listings.append(ProjectListing(package: package, summary: summary))
            }
        }
        return listings.sorted { $0.summary.updatedAt > $1.summary.updatedAt }
    }

    /// Every package in the folder, readable or not. A move takes all of them
    /// so none is left behind unseen.
    func packages() throws -> [ProjectPackage] {
        try ensureDirectory()
        let contents = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )
        return contents.filter(ProjectPackage.isPackage).map { ProjectPackage(url: $0) }
    }

    /// The summary sidecar, or one rebuilt from the project when the sidecar
    /// is missing or older than the project file.
    func summary(for package: ProjectPackage) -> ProjectSummary? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: package.summaryFileURL),
           let summary = try? decoder.decode(ProjectSummary.self, from: data)
        {
            return summary
        }
        guard let data = try? Data(contentsOf: package.projectFileURL),
              let project = try? decoder.decode(EditorProject.self, from: data)
        else { return nil }
        try? ProjectPackageStore.writeSummary(for: project, in: package)
        return ProjectSummary(project: project)
    }

    /// A new, empty package. The name is made unique the way Finder does it.
    func create(named name: String) throws -> ProjectPackage {
        try ensureDirectory()
        let package = ProjectPackage(url: uniqueURL(for: name))
        try FileManager.default.createDirectory(at: package.url, withIntermediateDirectories: true)
        return package
    }

    /// Resolve the original timeline by its stable ID, including projects opened
    /// outside the library. Names and downloaded recording identities are not IDs.
    func project(id: UUID, recentURLs: [URL] = []) throws -> ProjectPackage? {
        let packages = try listings().map(\.package) + recentURLs.filter(ProjectPackage.isPackage).map { ProjectPackage(url: $0) }
        return packages.first { decodeProject(in: $0)?.id == id }
    }

    /// Reopen the latest edited project for this account and this exact take.
    func project(for source: StudioContentSource) throws -> ProjectPackage? {
        for listing in try listings() {
            if decodeProject(in: listing.package)?.studioSource == source {
                return listing.package
            }
        }
        return nil
    }

    func rename(_ package: ProjectPackage, to name: String) throws -> ProjectPackage {
        let destination = uniqueURL(for: name, excluding: package.url)
        guard destination != package.url else { return package }
        try FileManager.default.moveItem(at: package.url, to: destination)
        RecentProjects.replace(package.url, with: destination)
        let renamed = ProjectPackage(url: destination)
        // The folder is the name. The project inside and its summary follow it,
        // so a rename from Finder or from the app reads the same in the grid.
        if var project = decodeProject(in: renamed) {
            project.name = renamed.displayName
            project.updatedAt = Date()
            try write(project, in: renamed)
        }
        return renamed
    }

    func duplicate(_ package: ProjectPackage) throws -> ProjectPackage {
        let copy = ProjectPackage(url: uniqueURL(for: package.displayName + " copy"))
        try FileManager.default.copyItem(at: package.url, to: copy.url)
        // The copy is its own project from here on.
        if var project = decodeProject(in: copy) {
            project.id = UUID()
            project.name = copy.displayName
            project.updatedAt = Date()
            try? FileManager.default.removeItem(at: copy.backupFileURL)
            try write(project, in: copy)
        }
        return copy
    }

    private func write(_ project: EditorProject, in package: ProjectPackage) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(project).write(to: package.projectFileURL, options: .atomic)
        try ProjectPackageStore.writeSummary(for: project, in: package)
    }

    /// To the Trash, never gone.
    func trash(_ package: ProjectPackage) throws {
        let projectID = summary(for: package)?.id
        try FileManager.default.trashItem(at: package.url, resultingItemURL: nil)
        if let projectID {
            try? FileManager.default.removeItem(at: PosterRenderCache.folder(for: projectID))
        }
        RecentProjects.forget(package.url)
    }

    /// The single `CurrentProject.json` the editor kept before projects
    /// existed becomes the first package, named after the project inside it.
    /// Runs once: the legacy file is renamed so it is never migrated twice, and
    /// never deleted so nothing is lost if the move goes wrong.
    func migrateLegacyProject(from legacyDirectory: URL) throws -> ProjectPackage? {
        let legacy = legacyDirectory.appending(path: "CurrentProject.json", directoryHint: .notDirectory)
        let legacyBackup = legacyDirectory.appending(path: "CurrentProject.backup.json", directoryHint: .notDirectory)
        guard FileManager.default.fileExists(atPath: legacy.path) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let data = try Data(contentsOf: legacy)
        let project = try decoder.decode(EditorProject.self, from: data)

        let package = try create(named: project.name)
        try data.write(to: package.projectFileURL, options: .atomic)
        if let backup = try? Data(contentsOf: legacyBackup) {
            try? backup.write(to: package.backupFileURL, options: .atomic)
        }
        try ProjectPackageStore.writeSummary(for: project, in: package)
        try FileManager.default.moveItem(
            at: legacy,
            to: legacyDirectory.appending(path: "CurrentProject.migrated.json", directoryHint: .notDirectory)
        )
        try? FileManager.default.removeItem(at: legacyBackup)
        return package
    }

    private func decodeProject(in package: ProjectPackage) -> EditorProject? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = try? Data(contentsOf: package.projectFileURL) else { return nil }
        guard let project = try? decoder.decode(EditorProject.self, from: data) else { return nil }
        return PackagedMediaLayout.relocated(GeneratedAssetLayout.relocated(project, to: package.url), to: package.url)
    }

    /// A pinned folder is made as needed. The Storage folder is made only when
    /// it is the default: a chosen one on an unplugged drive throws instead of
    /// getting an empty stand-in on this Mac.
    private func ensureDirectory() throws {
        if let pinnedDirectory {
            try FileManager.default.createDirectory(at: pinnedDirectory, withIntermediateDirectories: true)
        } else {
            _ = try folders.usableFolder(for: .editorProjects)
        }
    }

    private func uniqueURL(for name: String, excluding: URL? = nil) -> URL {
        ProjectPackage.uniqueURL(for: name, in: directory, excluding: excluding)
    }
}
