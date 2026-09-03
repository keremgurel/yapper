import Foundation

/// Persistence for one package: the project file with its known-good backup,
/// plus the summary the grid reads. Saving both from one place is what keeps a
/// card from ever describing a project other than the one on disk.
actor ProjectPackageStore: ProjectPersisting {
    let package: ProjectPackage
    private let store: ProjectStore

    init(package: ProjectPackage) {
        self.package = package
        store = ProjectStore(
            directory: package.url,
            primaryName: package.projectFileURL.lastPathComponent,
            backupName: package.backupFileURL.lastPathComponent
        )
    }

    func load() async throws -> EditorProject? {
        try await store.load()
    }

    func save(_ project: EditorProject) async throws {
        try await store.save(project)
        try Self.writeSummary(for: project, in: package)
    }

    func takeRecoveryNotice() async -> String? {
        await store.takeRecoveryNotice()
    }

    static func writeSummary(for project: EditorProject, in package: ProjectPackage) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(ProjectSummary(project: project))
        try data.write(to: package.summaryFileURL, options: .atomic)
    }
}
