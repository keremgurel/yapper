import Foundation

/// Every project the creator has, in one folder they can see in Finder.
///
/// Defaults to `~/Movies/Yapper Projects`. Nothing here talks to the network:
/// a project is a folder, listing is reading the folder, and deleting is the
/// Trash, so a mistake is undoable the way any file mistake is.
actor ProjectLibrary {
    static let shared = ProjectLibrary()
    private static let directoryKey = "projectsDirectoryPath"

    nonisolated let directory: URL

    init(directory: URL = ProjectLibrary.defaultDirectory) {
        self.directory = directory
    }

    static var defaultDirectory: URL {
        if ProjectStore.isTesting {
            return FileManager.default.temporaryDirectory
                .appending(
                    path: "YapperProjectsTests-\(ProcessInfo.processInfo.processIdentifier)",
                    directoryHint: .isDirectory
                )
        }
        if let path = UserDefaults.standard.string(forKey: directoryKey) {
            return URL(filePath: path, directoryHint: .isDirectory)
        }
        let movies = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask)[0]
        return movies.appending(path: "Yapper Projects", directoryHint: .isDirectory)
    }

    /// Newest edited first.
    func listings() throws -> [ProjectListing] {
        try ensureDirectory()
        let contents = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )
        var listings: [ProjectListing] = []
        for url in contents where ProjectPackage.isPackage(url) {
            let package = ProjectPackage(url: url)
            if let summary = summary(for: package) {
                listings.append(ProjectListing(package: package, summary: summary))
            }
        }
        return listings.sorted { $0.summary.updatedAt > $1.summary.updatedAt }
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
        try FileManager.default.trashItem(at: package.url, resultingItemURL: nil)
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
        return try? decoder.decode(EditorProject.self, from: data)
    }

    private func ensureDirectory() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func uniqueURL(for name: String, excluding: URL? = nil) -> URL {
        let base = ProjectPackage.fileName(for: name)
        var candidate = directory.appending(path: base, directoryHint: .isDirectory)
        var counter = 2
        while FileManager.default.fileExists(atPath: candidate.path), candidate != excluding {
            let stem = String(base.dropLast(ProjectPackage.pathExtension.count + 1))
            candidate = directory.appending(
                path: "\(stem) \(counter).\(ProjectPackage.pathExtension)",
                directoryHint: .isDirectory
            )
            counter += 1
        }
        return candidate
    }
}
