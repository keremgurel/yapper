import Foundation
import Testing
@testable import YapperNative

/// A hidden staged file outlives a crash only until the next launch.
@Suite(.serialized)
struct StagedExportLedgerTests {
    @Test("Delivery remembers its staged file while writing it and forgets it after")
    func deliveryRecordsStagedFile() async throws {
        let (folder, ledger, defaults, suite) = try fixture()
        defer { cleanUp(folder, defaults, suite) }
        let destination = folder.appending(path: "Talk.mp4")
        var recordedWhileWriting: [URL] = []

        try await StagedFileDelivery.deliver(
            to: destination,
            ledger: ledger,
            produce: { staged in
                recordedWhileWriting = ledger.recorded
                try Data("video".utf8).write(to: staged)
            },
            validate: { _ in }
        )

        #expect(recordedWhileWriting.count == 1)
        #expect(recordedWhileWriting.first?.lastPathComponent.hasPrefix(".Talk.yapper-export-") == true)
        #expect(ledger.recorded.isEmpty)
        #expect(FileManager.default.fileExists(atPath: destination.path))
    }

    @Test("A failed delivery removes its staged file and forgets it")
    func failedDeliveryForgets() async throws {
        let (folder, ledger, defaults, suite) = try fixture()
        defer { cleanUp(folder, defaults, suite) }
        var staged: URL?

        await #expect(throws: CancellationError.self) {
            try await StagedFileDelivery.deliver(
                to: folder.appending(path: "Talk.mp4"),
                ledger: ledger,
                produce: { url in
                    staged = url
                    try Data("partial".utf8).write(to: url)
                    throw CancellationError()
                },
                validate: { _ in }
            )
        }

        #expect(ledger.recorded.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: try #require(staged).path))
    }

    @Test("Launch deletes what a killed export left and clears the list")
    func launchRemovesLeftovers() throws {
        let (folder, ledger, defaults, suite) = try fixture()
        defer { cleanUp(folder, defaults, suite) }
        let leftover = folder.appending(path: ".Talk.yapper-export-\(UUID().uuidString).mp4")
        let alreadyGone = folder.appending(path: ".Gone.yapper-export-\(UUID().uuidString).mp4")
        let unrelated = folder.appending(path: "Talk.mp4")
        try Data("partial".utf8).write(to: leftover)
        try Data("keep".utf8).write(to: unrelated)
        ledger.record(leftover)
        ledger.record(alreadyGone)

        let removed = StagedExportLedger.remove(ledger.takeLeftovers())

        #expect(removed == [leftover])
        #expect(!FileManager.default.fileExists(atPath: leftover.path))
        #expect(FileManager.default.fileExists(atPath: unrelated.path))
        #expect(ledger.recorded.isEmpty)
    }

    private func fixture() throws -> (URL, StagedExportLedger, UserDefaults, String) {
        let folder = FileManager.default.temporaryDirectory
            .appending(path: "yapper-ledger-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let suite = "yapper-ledger-tests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        return (folder, StagedExportLedger(defaults: defaults), defaults, suite)
    }

    private func cleanUp(_ folder: URL, _ defaults: UserDefaults, _ suite: String) {
        try? FileManager.default.removeItem(at: folder)
        defaults.removePersistentDomain(forName: suite)
    }
}
