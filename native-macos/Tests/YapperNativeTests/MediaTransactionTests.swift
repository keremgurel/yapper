import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor MediaTransactionStore: ProjectPersisting {
    enum Failure: LocalizedError { case diskFull; var errorDescription: String? { "disk full" } }
    var failure: Failure?
    private(set) var projects: [EditorProject] = []

    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        if let failure { throw failure }
        projects.append(project)
    }
    func failSaves() { failure = .diskFull }
    func snapshot() -> [EditorProject] { projects }
}

@Suite(.serialized)
@MainActor
struct MediaTransactionTests {
    @Test("Failed import leaves no derived-media residue")
    func failedImportHasNoDerivedResidue() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let image = directory.appending(path: "red.png")
        try writePNG(.red, to: image)
        let store = MediaTransactionStore()
        await store.failSaves()
        let session = EditorSession(store: store)

        await session.importMedia([image])

        #expect(session.project.media.isEmpty)
        #expect(session.thumbnailsByMedia.isEmpty)
        #expect(session.waveformByMedia.isEmpty)
        #expect(session.waveformProgressByMedia.isEmpty)
        #expect(await store.snapshot().isEmpty)
    }

    @Test("Delete, undo, and redo reconcile derived image state")
    func deleteUndoRedoReconcilesDerivedState() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let image = directory.appending(path: "red.png")
        try writePNG(.red, to: image)
        let session = EditorSession(store: MediaTransactionStore())
        await session.importMedia([image])
        let id = try #require(session.project.media.first?.id)
        #expect(session.thumbnailsByMedia[id] != nil)

        await session.deleteImportedMedia(id)
        #expect(session.project.media.isEmpty)
        #expect(session.thumbnailsByMedia[id] == nil)

        await session.undo()
        #expect(session.project.media.map(\.id) == [id])
        #expect(session.thumbnailsByMedia[id] != nil)

        await session.redo()
        #expect(session.project.media.isEmpty)
        #expect(session.thumbnailsByMedia[id] == nil)
    }

    @Test("Relink rejects different image bytes even when dimensions match")
    func relinkRejectsWrongImageIdentity() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let red = directory.appending(path: "red.png")
        let blue = directory.appending(path: "blue.png")
        try writePNG(.red, to: red)
        try writePNG(.blue, to: blue)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([red])
        let original = try #require(session.project.media.first)
        let savesBefore = await store.snapshot().count

        await session.relinkMedia(original, to: blue)

        #expect(session.project.media.first == original)
        #expect(await store.snapshot().count == savesBefore)
        #expect(session.errorMessage?.contains("same source media") == true)
    }

    @Test("Relink rejects video with incompatible duration")
    func relinkRejectsWrongVideoDuration() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let short = directory.appending(path: "short.mov")
        let long = directory.appending(path: "long.mov")
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 160, height: 90), seconds: 1, to: short)
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 160, height: 90), seconds: 2.5, to: long)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([short])
        let original = try #require(session.project.media.first)
        let savesBefore = await store.snapshot().count

        await session.relinkMedia(original, to: long)

        #expect(session.project.media.first == original)
        #expect(await store.snapshot().count == savesBefore)
    }

    @Test("Failed relink save rolls memory and durable project back")
    func failedRelinkSaveRollsBack() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let originalURL = directory.appending(path: "original.png")
        let movedURL = directory.appending(path: "moved.png")
        try writePNG(.red, to: originalURL)
        try FileManager.default.copyItem(at: originalURL, to: movedURL)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([originalURL])
        let original = try #require(session.project.media.first)
        let durableBefore = try #require(await store.snapshot().last)
        await store.failSaves()

        await session.relinkMedia(original, to: movedURL)

        #expect(session.project == durableBefore)
        #expect(await store.snapshot().last == durableBefore)
        #expect(session.errorMessage == "disk full")
    }

    @Test("Failed offline video relink never leaves player on rejected replacement")
    func failedOfflineVideoRelinkClearsRejectedPlayer() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let originalURL = directory.appending(path: "original.mov")
        let movedURL = directory.appending(path: "moved.mov")
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 160, height: 90), to: originalURL)
        try FileManager.default.copyItem(at: originalURL, to: movedURL)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([originalURL])
        let durableBefore = try #require(await store.snapshot().last)
        let media = try #require(durableBefore.media.first)
        try FileManager.default.removeItem(at: originalURL)
        session.refreshMediaAvailability(notifyRestored: false)
        await store.failSaves()

        await session.relinkMedia(media, to: movedURL)

        #expect(session.project == durableBefore)
        #expect(await store.snapshot().last == durableBefore)
        #expect(session.player.currentItem == nil)
    }

    @Test("A corrupt same-name neighbour is never auto-relinked")
    func invalidNeighbourIsSkipped() async throws {
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let old = root.appending(path: "old", directoryHint: .isDirectory)
        let moved = root.appending(path: "moved", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: old, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: moved, withIntermediateDirectories: true)
        let first = old.appending(path: "first.png")
        let second = old.appending(path: "second.png")
        try writePNG(.red, to: first)
        try writePNG(.blue, to: second)
        let session = EditorSession(store: MediaTransactionStore())
        await session.importMedia([first, second])
        let imported = session.project.media
        try FileManager.default.copyItem(at: first, to: moved.appending(path: "first.png"))
        try Data("not an image".utf8).write(to: moved.appending(path: "second.png"))
        try FileManager.default.removeItem(at: first)
        try FileManager.default.removeItem(at: second)
        session.refreshMediaAvailability(notifyRestored: false)

        await session.relinkMedia(imported[0], to: moved.appending(path: "first.png"))

        #expect(session.project.media[0].url == moved.appending(path: "first.png").resolvingSymlinksInPath())
        #expect(session.project.media[1].url == imported[1].url)
    }

    @Test("Relink rewrites prior undo and redo snapshots to the recovered source")
    func relinkPreservesPriorHistory() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.png")
        let moved = directory.appending(path: "moved.png")
        try writePNG(.red, to: source)
        try FileManager.default.copyItem(at: source, to: moved)
        let session = EditorSession(store: MediaTransactionStore())
        await session.importMedia([source])
        let imported = try #require(session.project.media.first)
        let originalName = session.project.name
        _ = await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.name = "Edited name" }
            return true
        }
        try FileManager.default.removeItem(at: source)
        session.refreshMediaAvailability(notifyRestored: false)
        await session.relinkMedia(imported, to: moved)

        await session.undo()
        #expect(session.project.name == originalName)
        #expect(session.project.media.first?.url == moved.resolvingSymlinksInPath())

        await session.redo()
        #expect(session.project.name == "Edited name")
        #expect(session.project.media.first?.url == moved.resolvingSymlinksInPath())
    }

    @Test("Generation fence rejects late completion after identity changes")
    func generationFenceRejectsLateCompletion() {
        let id = UUID()
        var fence = DerivedMediaGenerationFence()
        let old = fence.advance(id)
        let current = fence.advance(id)
        #expect(!fence.accepts(id, generation: old))
        #expect(fence.accepts(id, generation: current))
    }

    @Test("Legacy weak relink cannot shorten source needed by older history")
    func legacyWeakRelinkRejectsShorterSource() {
        let original = ProjectMedia(
            url: URL(filePath: "/tmp/original.mov"),
            name: "original.mov",
            duration: 100,
            width: 1920,
            height: 1080,
            hasAudio: true
        )
        let shorter = ProjectMedia(
            url: URL(filePath: "/tmp/candidate.mov"),
            name: "candidate.mov",
            duration: 96,
            width: 1920,
            height: 1080,
            hasAudio: true
        )
        var frameEquivalent = shorter
        frameEquivalent.duration = 99.96
        #expect(!RelinkCompatibility.weakDurationPreservesHistory(original: original, replacement: shorter))
        #expect(RelinkCompatibility.weakDurationPreservesHistory(original: original, replacement: frameEquivalent))
    }

    @Test("Sampled source identity matches a moved copy and detects sampled mutation")
    func sampledFingerprintIdentity() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.bin")
        let copy = directory.appending(path: "copy.bin")
        try Data(repeating: 7, count: 256 * 1024).write(to: source)
        try FileManager.default.copyItem(at: source, to: copy)
        let original = try await MediaSourceFingerprint.compute(url: source)
        #expect(try await MediaSourceFingerprint.compute(url: copy) == original)

        let handle = try FileHandle(forWritingTo: copy)
        try handle.seek(toOffset: 128 * 1024)
        try handle.write(contentsOf: Data(repeating: 9, count: 1024))
        try handle.close()
        #expect(try await MediaSourceFingerprint.compute(url: copy) != original)
    }

    @Test("Cancelling a source identity probe cancels its reads")
    func sampledFingerprintCancellation() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.bin")
        try Data(repeating: 1, count: 256 * 1024).write(to: source)
        let task = Task {
            try await MediaSourceFingerprint.compute(url: source) {
                try await Task.sleep(for: .seconds(30))
            }
        }
        await Task.yield()
        task.cancel()
        do {
            _ = try await task.value
            Issue.record("Cancelled fingerprint unexpectedly completed")
        } catch is CancellationError {
            // Expected: cancellation propagates into detached file work.
        }
    }

    @Test("Automatic recovery rejects different bytes returning at the same path")
    func automaticRecoveryRejectsChangedIdentity() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.png")
        let exactCopy = directory.appending(path: "exact-copy.png")
        try writePNG(.red, to: source)
        try FileManager.default.copyItem(at: source, to: exactCopy)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([source])
        let saved = try #require(await store.snapshot().last)
        try FileManager.default.removeItem(at: source)
        session.refreshMediaAvailability(notifyRestored: false)
        try writePNG(.blue, to: source)

        do {
            try await session.reloadAfterRecovery()
            Issue.record("Different source bytes were accepted")
        } catch {
            // Expected.
        }

        #expect(session.project == saved)
        #expect(await store.snapshot().count == 1)
        #expect(session.offlineMedia.map(\.id) == saved.media.map(\.id))

        session.refreshMediaAvailability()
        session.refreshMediaAvailability()
        try await Task.sleep(for: .milliseconds(25))
        #expect(await store.snapshot().count == 1)
        #expect(session.offlineMedia.map(\.id) == saved.media.map(\.id))

        await session.relinkMedia(saved.media[0], to: exactCopy)
        #expect(session.offlineMedia.isEmpty)
        #expect(session.project.media[0].url == exactCopy.resolvingSymlinksInPath())
    }

    @Test("A same-path overwrite is rejected before the next composition rebuild")
    func samePathOverwriteIsRejected() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 160, height: 90), to: source)
        let store = MediaTransactionStore()
        let session = EditorSession(store: store)
        await session.importMedia([source])
        let durable = try #require(await store.snapshot().last)
        try await SyntheticVideo.write(color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), to: source)

        await session.recoverRestoredMedia()

        #expect(session.project == durable)
        #expect(await store.snapshot().count == 1)
        #expect(session.offlineMedia.map(\.id) == durable.media.map(\.id))
        #expect(session.errorMessage?.contains("same source media") == true)
        #expect(session.player.currentItem == nil)
    }

    private func writePNG(_ color: NSColor, to url: URL) throws {
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: 32,
            pixelsHigh: 18,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        color.setFill()
        NSRect(x: 0, y: 0, width: 32, height: 18).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: url)
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-media-transaction-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
