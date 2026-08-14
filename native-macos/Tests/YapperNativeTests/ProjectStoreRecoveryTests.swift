import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct ProjectStoreRecoveryTests {
    @Test("The first durable project also establishes a known-good backup")
    func firstSaveCreatesBackup() async throws {
        try await withStore { store, directory in
            let project = EditorProject(name: "First")
            try await store.save(project)

            let expected = try roundTripped(project)
            #expect(try decoded(at: primary(in: directory)) == expected)
            #expect(try decoded(at: backup(in: directory)) == expected)
        }
    }

    @Test("A later save preserves the previous decodable project")
    func laterSaveRotatesPreviousPrimary() async throws {
        try await withStore { store, directory in
            let first = EditorProject(name: "First")
            let second = EditorProject(name: "Second")
            try await store.save(first)
            try await store.save(second)

            #expect(try decoded(at: primary(in: directory)) == roundTripped(second))
            #expect(try decoded(at: backup(in: directory)) == roundTripped(first))
        }
    }

    @Test("A corrupt primary recovers and repairs from the known-good backup")
    func corruptPrimaryRecovers() async throws {
        try await withStore { store, directory in
            let first = EditorProject(name: "First")
            let second = EditorProject(name: "Second")
            try await store.save(first)
            try await store.save(second)
            try Data("{broken".utf8).write(to: primary(in: directory), options: .atomic)

            let expected = try roundTripped(first)
            #expect(try await store.load() == expected)
            #expect(try decoded(at: primary(in: directory)) == expected)
            #expect(await store.takeRecoveryNotice() != nil)
            #expect(await store.takeRecoveryNotice() == nil)
        }
    }

    @Test("A missing primary is restored from backup")
    func missingPrimaryRecovers() async throws {
        try await withStore { store, directory in
            let project = EditorProject(name: "Only copy")
            try await store.save(project)
            try FileManager.default.removeItem(at: primary(in: directory))

            let expected = try roundTripped(project)
            #expect(try await store.load() == expected)
            #expect(try decoded(at: primary(in: directory)) == expected)
        }
    }

    @Test("A corrupt primary never rotates over an existing valid backup")
    func savePreservesBackupWhenPrimaryIsCorrupt() async throws {
        try await withStore { store, directory in
            let first = EditorProject(name: "First")
            let second = EditorProject(name: "Second")
            let third = EditorProject(name: "Third")
            try await store.save(first)
            try await store.save(second)
            try Data("bad primary".utf8).write(to: primary(in: directory), options: .atomic)

            try await store.save(third)

            #expect(try decoded(at: primary(in: directory)) == roundTripped(third))
            #expect(try decoded(at: backup(in: directory)) == roundTripped(first))
        }
    }

    @Test("A valid primary wins even when the backup is corrupt")
    func validPrimaryWins() async throws {
        try await withStore { store, directory in
            let project = EditorProject(name: "Primary")
            try await store.save(project)
            try Data("bad backup".utf8).write(to: backup(in: directory), options: .atomic)

            #expect(try await store.load() == roundTripped(project))
            #expect(await store.takeRecoveryNotice() == nil)
        }
    }

    @Test("Two corrupt copies fail closed without changing either file")
    func bothCorruptFailClosed() async throws {
        try await withStore { store, directory in
            let brokenPrimary = Data("bad primary".utf8)
            let brokenBackup = Data("bad backup".utf8)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try brokenPrimary.write(to: primary(in: directory))
            try brokenBackup.write(to: backup(in: directory))

            await #expect(throws: (any Error).self) {
                _ = try await store.load()
            }
            #expect(try Data(contentsOf: primary(in: directory)) == brokenPrimary)
            #expect(try Data(contentsOf: backup(in: directory)) == brokenBackup)
        }
    }

    private func withStore(
        _ operation: (ProjectStore, URL) async throws -> Void
    ) async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-project-recovery-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: directory) }
        try await operation(ProjectStore(directory: directory), directory)
    }

    private func primary(in directory: URL) -> URL {
        directory.appending(path: "CurrentProject.json")
    }

    private func backup(in directory: URL) -> URL {
        directory.appending(path: "CurrentProject.backup.json")
    }

    private func decoded(at url: URL) throws -> EditorProject {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(EditorProject.self, from: Data(contentsOf: url))
    }

    private func roundTripped(_ project: EditorProject) throws -> EditorProject {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(EditorProject.self, from: encoder.encode(project))
    }
}
