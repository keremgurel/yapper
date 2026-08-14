import Foundation
import Testing
@testable import YapperNative

private final class TestAudioLibraryManifest: AudioLibraryManifestPersisting {
    enum Failure: Error { case unavailable, corrupt }

    var index: AudioLibraryIndex?
    var loadFailure: Error?
    var saveFailure: Error?
    private(set) var saveAttempts = 0

    init(index: AudioLibraryIndex? = nil) { self.index = index }

    func load() throws -> AudioLibraryIndex? {
        if let loadFailure { throw loadFailure }
        return index
    }

    func save(_ index: AudioLibraryIndex) throws {
        saveAttempts += 1
        if let saveFailure { throw saveFailure }
        self.index = index
    }
}

private actor BlockingAudioImporter: AudioLibraryImporting {
    private var continuation: CheckedContinuation<Void, Never>?
    private var waiter: CheckedContinuation<Void, Never>?
    private(set) var calls = 0

    func stageFile(
        at source: URL,
        taken _: Set<String>,
        existingHashes _: Set<String>
    ) async throws -> StagedAudioImport? {
        calls += 1
        waiter?.resume()
        waiter = nil
        await withCheckedContinuation { continuation = $0 }
        try Task.checkCancellation()
        let item = SavedAudio(
            name: "Blocked",
            kind: .effect,
            fileName: "blocked.m4a",
            duration: 1,
            contentHash: "blocked"
        )
        let staged = AudioLibraryFolder.stagedURL(fileName: item.fileName)
        AudioLibraryFolder.ensureTransactionDirectories()
        try Data("audio".utf8).write(to: staged)
        return StagedAudioImport(item: item, stagedURL: staged)
    }

    func waitUntilCalled() async {
        guard calls == 0 else { return }
        await withCheckedContinuation { waiter = $0 }
    }

    func release() {
        continuation?.resume()
        continuation = nil
    }
}

private actor RecordingAudioImporter: AudioLibraryImporting {
    enum Behavior { case cancel, staged(SavedAudio) }

    let behavior: Behavior
    private(set) var sources: [URL] = []

    init(_ behavior: Behavior) { self.behavior = behavior }

    func stageFile(
        at source: URL,
        taken _: Set<String>,
        existingHashes _: Set<String>
    ) async throws -> StagedAudioImport? {
        sources.append(source)
        switch behavior {
        case .cancel:
            throw CancellationError()
        case let .staged(item):
            AudioLibraryFolder.ensureTransactionDirectories()
            let stagedURL = AudioLibraryFolder.stagedURL(fileName: item.fileName)
            try Data("staged".utf8).write(to: stagedURL)
            return StagedAudioImport(item: item, stagedURL: stagedURL)
        }
    }
}

private actor LateCancelAudioImporter: AudioLibraryImporting {
    private var releaseContinuation: CheckedContinuation<Void, Never>?
    private var calledContinuation: CheckedContinuation<Void, Never>?
    private var called = false
    let item: SavedAudio

    init(item: SavedAudio) { self.item = item }

    func stageFile(
        at _: URL,
        taken _: Set<String>,
        existingHashes _: Set<String>
    ) async throws -> StagedAudioImport? {
        called = true
        calledContinuation?.resume()
        calledContinuation = nil
        await withCheckedContinuation { releaseContinuation = $0 }
        AudioLibraryFolder.ensureTransactionDirectories()
        let staged = AudioLibraryFolder.stagedURL(fileName: item.fileName)
        try Data("completed copy".utf8).write(to: staged)
        return StagedAudioImport(item: item, stagedURL: staged)
    }

    func waitUntilCalled() async {
        guard !called else { return }
        await withCheckedContinuation { calledContinuation = $0 }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

private actor AsyncTestGate {
    private var arrived = false
    private var arrivalContinuation: CheckedContinuation<Void, Never>?
    private var releaseContinuation: CheckedContinuation<Void, Never>?

    func arriveAndWait() async {
        arrived = true
        arrivalContinuation?.resume()
        arrivalContinuation = nil
        await withCheckedContinuation { releaseContinuation = $0 }
    }

    func waitUntilArrived() async {
        guard !arrived else { return }
        await withCheckedContinuation { arrivalContinuation = $0 }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

/// The library is a folder the creator builds up over months, so what is tested
/// here is mostly what must never happen to it: a file silently overwriting
/// another, the same sound arriving twice, an entry outliving its file without
/// saying so.
@Suite(.serialized)
@MainActor
struct AudioLibraryTests {
    /// Every test writes to the real store, which under test is a per-process
    /// temp directory (`ProjectStore.isTesting`). Cleared between tests so one
    /// import cannot be read by the next.
    private func freshStore() -> AudioLibraryStore {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        return AudioLibraryStore()
    }

    /// A real, decodable audio file, because the importer probes duration and a
    /// handful of random bytes has none.
    private func sampleAudio(named name: String) throws -> URL {
        let bundled = try #require(
            Bundle.module.url(forResource: "pop", withExtension: "m4a", subdirectory: "SoundEffects"),
            "the shipped sound effects are the only real audio a test can lean on"
        )
        let copy = FileManager.default.temporaryDirectory.appending(path: name)
        try? FileManager.default.removeItem(at: copy)
        try FileManager.default.copyItem(at: bundled, to: copy)
        return copy
    }

    @Test("A brand-new library does not schedule recovery work")
    func newLibrarySkipsRecovery() {
        let store = freshStore()

        #expect(!store.isRecovering)
        #expect(store.items.isEmpty)
    }

    @Test("An imported file is copied into the library and probed")
    func importsAndCopies() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "imported-pop.m4a")

        let added = try await store.add([source])

        let item = try #require(added.first)
        #expect(store.items.count == 1)
        #expect(item.duration > 0)
        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        // The file the creator imported from is never moved or touched.
        #expect(FileManager.default.fileExists(atPath: source.path))
    }

    @Test("The same file imported twice is saved once")
    func dedupesByContent() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "twice.m4a")

        try await store.add([source])
        let second = try await store.add([source])

        #expect(second.isEmpty)
        #expect(store.items.count == 1)
    }

    @Test("Two different files with the same name both survive")
    func keepsBothOfAName() async throws {
        let store = freshStore()
        let first = try sampleAudio(named: "clash.m4a")
        // Different bytes, same name, which is what makes it a real collision
        // rather than a re-import.
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "clash-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let second = directory.appending(path: "clash.m4a")
        var bytes = try Data(contentsOf: first)
        bytes.append(contentsOf: [0x00, 0x01, 0x02])
        try bytes.write(to: second)

        try await store.add([first, second])

        #expect(store.items.count == 2)
        let names = Set(store.items.map(\.fileName))
        #expect(names.count == 2, "one copy must not overwrite the other")
        for item in store.items {
            #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        }
    }

    @Test("The library survives a relaunch")
    func persists() async throws {
        let store = freshStore()
        try await store.add([try sampleAudio(named: "persisted.m4a")])
        let saved = try #require(store.items.first)
        await store.rename(saved.id, to: "Intro bed")
        await store.setKind(.music, for: saved.id)

        let reopened = AudioLibraryStore()

        let item = try #require(reopened.items.first)
        #expect(reopened.items.count == 1)
        #expect(item.name == "Intro bed")
        #expect(item.kind == .music)
    }

    @Test("Deleting takes the copy with it, and nothing else")
    func deletes() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "deleted.m4a")
        try await store.add([source])
        let item = try #require(store.items.first)
        let copy = store.url(for: item)

        await store.remove(item.id)

        #expect(store.items.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: copy.path))
        #expect(FileManager.default.fileExists(atPath: source.path), "the original is not ours")
    }

    @Test("A saved sound whose file is gone is reported, not dropped")
    func reportsMissingFiles() async throws {
        let store = freshStore()
        try await store.add([try sampleAudio(named: "vanishing.m4a")])
        let item = try #require(store.items.first)
        try FileManager.default.removeItem(at: store.url(for: item))

        let reopened = AudioLibraryStore()
        await reopened.waitForRecovery()

        #expect(reopened.items.count == 1, "the entry is the creator's to delete")
        #expect(reopened.missingIDs.contains(item.id))
    }

    @Test("Shelves are newest first, within a kind")
    func shelvesNewestFirst() async throws {
        let store = freshStore()
        let first = try sampleAudio(named: "older.m4a")
        var bytes = try Data(contentsOf: first)
        bytes.append(0x7f)
        let second = FileManager.default.temporaryDirectory.appending(path: "newer.m4a")
        try? FileManager.default.removeItem(at: second)
        try bytes.write(to: second)

        try await store.add([first])
        try await store.add([second])
        for item in store.items { await store.setKind(.effect, for: item.id) }

        let shelf = store.items(of: .effect)
        #expect(shelf.count == 2)
        #expect(shelf[0].addedAt >= shelf[1].addedAt)
    }

    @Test("Import manifest failure removes the staged and final copy")
    func importManifestFailureRollsBackFiles() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let manifest = TestAudioLibraryManifest()
        manifest.saveFailure = TestAudioLibraryManifest.Failure.unavailable
        let store = AudioLibraryStore(manifest: manifest)
        let source = try sampleAudio(named: "manifest-failure.m4a")

        let added = try await store.add([source])

        #expect(added.isEmpty)
        #expect(store.items.isEmpty)
        #expect(manifest.saveAttempts == 1)
        let root = (try? FileManager.default.contentsOfDirectory(
            at: AudioLibraryFolder.directory,
            includingPropertiesForKeys: nil
        )) ?? []
        #expect(!root.contains { $0.pathExtension == "m4a" })
        let staged = (try? FileManager.default.contentsOfDirectory(
            at: AudioLibraryFolder.stagingDirectory,
            includingPropertiesForKeys: nil
        )) ?? []
        #expect(staged.isEmpty)
    }

    @Test("Rename and category are published only after the manifest commits")
    func metadataFailureDoesNotPublish() async throws {
        let (item, manifest, store) = try seededStore(named: "metadata.m4a")
        manifest.saveFailure = TestAudioLibraryManifest.Failure.unavailable

        await store.rename(item.id, to: "False success")
        await store.setKind(.voice, for: item.id)

        #expect(store.items.first?.name == item.name)
        #expect(store.items.first?.kind == item.kind)
        #expect(manifest.index?.items.first == item)
    }

    @Test("Delete manifest failure restores the owned file and catalog")
    func deleteFailureRestoresFile() async throws {
        let (item, manifest, store) = try seededStore(named: "delete-rollback.m4a")
        manifest.saveFailure = TestAudioLibraryManifest.Failure.unavailable
        let owned = store.url(for: item)

        let removed = await store.remove(item.id)

        #expect(!removed)
        #expect(store.items == [item])
        #expect(FileManager.default.fileExists(atPath: owned.path))
        #expect(manifest.index?.items == [item])
    }

    @Test("A referenced saved sound is never tombstoned")
    func referencedDeleteIsBlocked() async throws {
        let (item, manifest, store) = try seededStore(named: "referenced.m4a")
        let owned = store.url(for: item)

        let removed = await store.remove(item.id, isReferenced: { true })

        #expect(!removed)
        #expect(store.items == [item])
        #expect(FileManager.default.fileExists(atPath: owned.path))
        #expect(manifest.saveAttempts == 0)
        #expect(store.errorMessage?.contains("undo history") == true)
    }

    @Test("Delete after add probing cannot leave a dangling saved-audio layer")
    func deleteWinsAgainstProbedAdd() async throws {
        let (item, _, store) = try seededStore(named: "add-delete-race.m4a")
        let session = EditorSession()
        let media = ProjectMedia(
            url: URL(filePath: "/tmp/unbuilt-race-video.mov"),
            name: "Race", duration: 2, width: 100, height: 100, hasAudio: false
        )
        session.updateProject {
            $0.media = [media]
            $0.clips = [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2)]
        }
        let gate = AsyncTestGate()
        let addition = Task {
            await session.addSavedAudio(item, from: store) {
                await gate.arriveAndWait()
            }
        }
        await gate.waitUntilArrived()

        #expect(await session.removeSavedAudio(item, from: store))
        await gate.release()
        await addition.value

        #expect(store.items.isEmpty)
        #expect(session.project.audioLayers?.isEmpty != false)
        #expect(session.errorMessage?.contains("audio") == true)
    }

    @Test("History reference matching covers id, exact hash, and legacy path")
    func historyReferenceMatching() throws {
        let item = SavedAudio(
            name: "History",
            kind: .music,
            fileName: "history.m4a",
            duration: 2,
            contentHash: "exact-hash"
        )
        let url = AudioLibraryFolder.url(for: item)
        var history = EditorHistory()
        var byHash = EditorProject()
        byHash.audioLayers = [ProjectAudioLayer(
            url: URL(filePath: "/moved.m4a"), name: "Moved", timelineStart: 0,
            duration: 1, sourceKind: .saved, savedAudioHash: item.contentHash
        )]
        history.record(before: byHash, after: EditorProject(name: "after"))
        #expect(history.referencesSavedAudio(item, url: url))

        var legacy = EditorProject()
        legacy.audioLayers = [ProjectAudioLayer(
            url: url, name: "Legacy", timelineStart: 0, duration: 1,
            sourceKind: nil
        )]
        var legacyHistory = EditorHistory()
        legacyHistory.record(before: legacy, after: EditorProject(name: "after"))
        #expect(legacyHistory.referencesSavedAudio(item, url: url))
    }

    @Test("Unreadable manifest fails closed and preserves unknown files")
    func corruptManifestFailsClosed() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let unknown = AudioLibraryFolder.fileURL(named: "unknown.m4a")
        try Data("creator bytes".utf8).write(to: unknown)
        let manifest = TestAudioLibraryManifest()
        manifest.loadFailure = TestAudioLibraryManifest.Failure.corrupt
        let importer = BlockingAudioImporter()
        let store = AudioLibraryStore(importer: importer, manifest: manifest)

        do {
            _ = try await store.add([unknown])
            Issue.record("Unreadable catalog looked like a successful no-op")
        } catch {
            #expect(error.localizedDescription.contains("unreadable"))
        }
        #expect(await importer.calls == 0)
        #expect(FileManager.default.fileExists(atPath: unknown.path))
        #expect(store.errorMessage?.contains("unreadable") == true)
    }

    @Test("Concurrent mutation is explicit and cannot duplicate an import")
    func concurrentMutationIsRejectedExplicitly() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let importer = BlockingAudioImporter()
        let store = AudioLibraryStore(importer: importer, manifest: TestAudioLibraryManifest())
        let source = URL(filePath: "/tmp/blocked.m4a")
        let first = Task { try await store.add([source]) }
        await importer.waitUntilCalled()

        do {
            _ = try await store.add([source])
            Issue.record("Concurrent add looked like a successful dedupe")
        } catch {
            #expect(error.localizedDescription.contains("current audio library change"))
        }
        await importer.release()
        _ = try await first.value
        #expect(await importer.calls == 1)
    }

    @Test("Cancellation is terminal for a batch and does not become a false import failure")
    func batchCancellationIsTerminal() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let importer = RecordingAudioImporter(.cancel)
        let manifest = TestAudioLibraryManifest()
        let store = AudioLibraryStore(importer: importer, manifest: manifest)
        let first = URL(filePath: "/tmp/first.m4a")
        let second = URL(filePath: "/tmp/second.m4a")

        do {
            _ = try await store.add([first, second])
            Issue.record("Cancellation was swallowed")
        } catch is CancellationError {
            // Expected.
        }

        #expect(await importer.sources == [first])
        #expect(store.items.isEmpty)
        #expect(store.importingName == nil)
        #expect(store.errorMessage == nil)
        #expect(manifest.saveAttempts == 0)
    }

    @Test("Cancellation after staging cannot promote or publish the file")
    func lateCancellationDiscardsStaging() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let item = SavedAudio(
            name: "Late", kind: .effect, fileName: "late-cancel.m4a",
            duration: 1, contentHash: "late"
        )
        let importer = LateCancelAudioImporter(item: item)
        let manifest = TestAudioLibraryManifest()
        let store = AudioLibraryStore(importer: importer, manifest: manifest)
        let importTask = Task { try await store.add([URL(filePath: "/tmp/late.m4a")]) }
        await importer.waitUntilCalled()
        importTask.cancel()
        await importer.release()

        do {
            _ = try await importTask.value
            Issue.record("Late cancellation committed an import")
        } catch is CancellationError {
            // Expected.
        }
        #expect(store.items.isEmpty)
        #expect(manifest.saveAttempts == 0)
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.url(for: item).path))
        let staged = (try? FileManager.default.contentsOfDirectory(
            at: AudioLibraryFolder.stagingDirectory,
            includingPropertiesForKeys: nil
        )) ?? []
        #expect(staged.isEmpty)
    }

    @Test("Streaming copy cancellation removes its partial staging file")
    func streamingCopyCancellationCleansUp() async throws {
        let source = FileManager.default.temporaryDirectory
            .appending(path: "audio-copy-source-\(UUID().uuidString)")
        let destination = FileManager.default.temporaryDirectory
            .appending(path: "audio-copy-destination-\(UUID().uuidString)")
        try Data(repeating: 0x5a, count: 2 << 20).write(to: source)
        defer {
            try? FileManager.default.removeItem(at: source)
            try? FileManager.default.removeItem(at: destination)
        }
        let started = AsyncStream<Void>.makeStream()
        var iterator = started.stream.makeAsyncIterator()
        let gate = DispatchSemaphore(value: 0)
        let copy = Task {
            try await CancellableFileCopy.copy(source: source, destination: destination) {
                started.continuation.yield()
                gate.wait()
            }
        }
        _ = await iterator.next()
        copy.cancel()
        gate.signal()

        do {
            try await copy.value
            Issue.record("Canceled copy completed")
        } catch is CancellationError {
            // Expected.
        }
        #expect(!FileManager.default.fileExists(atPath: destination.path))
    }

    @Test("A failed final move cannot publish or persist an import")
    func finalMoveFailureDoesNotPublish() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let item = SavedAudio(
            name: "Move", kind: .effect, fileName: "move-failure.m4a",
            duration: 1, contentHash: "move"
        )
        let importer = RecordingAudioImporter(.staged(item))
        let manifest = TestAudioLibraryManifest()
        var operations = AudioLibraryFileOperations.live
        operations.move = { _, _ in throw CocoaError(.fileWriteUnknown) }
        let store = AudioLibraryStore(importer: importer, manifest: manifest, files: operations)

        let added = try await store.add([URL(filePath: "/tmp/move.m4a")])

        #expect(added.isEmpty)
        #expect(store.items.isEmpty)
        #expect(manifest.saveAttempts == 0)
        #expect(!FileManager.default.fileExists(
            atPath: AudioLibraryFolder.stagedURL(fileName: item.fileName).path
        ))
    }

    @Test("A committed delete with failed trash cleanup is retried at startup")
    func deleteCleanupIsRetryable() async throws {
        let (item, manifest, _) = try seededStore(named: "delete-retry.m4a")
        let tombstone = AudioLibraryFolder.tombstoneURL(for: item)
        var operations = AudioLibraryFileOperations.live
        operations.remove = { url in
            if url == tombstone { throw CocoaError(.fileWriteUnknown) }
            try FileManager.default.removeItem(at: url)
        }
        let store = AudioLibraryStore(manifest: manifest, files: operations)

        #expect(await store.remove(item.id))
        #expect(store.items.isEmpty)
        #expect(FileManager.default.fileExists(atPath: tombstone.path))

        let reopened = AudioLibraryStore(manifest: manifest)
        await reopened.waitForRecovery()
        #expect(!FileManager.default.fileExists(atPath: tombstone.path))
    }

    @Test("Delete rechecks references after startup recovery finishes")
    func deleteRechecksReferenceAfterRecovery() async throws {
        let (item, manifest, _) = try seededStore(named: "late-reference.m4a")
        let recoveryStarted = AsyncStream<Void>.makeStream()
        var iterator = recoveryStarted.stream.makeAsyncIterator()
        let recoveryGate = DispatchSemaphore(value: 0)
        var operations = AudioLibraryFileOperations.live
        operations.contents = { url in
            if url == AudioLibraryFolder.trashDirectory {
                recoveryStarted.continuation.yield()
                recoveryGate.wait()
            }
            return try FileManager.default.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: [.isRegularFileKey]
            )
        }
        let store = AudioLibraryStore(manifest: manifest, files: operations)
        var referenced = false
        let deletion = Task { await store.remove(item.id, isReferenced: { referenced }) }
        _ = await iterator.next()
        referenced = true
        recoveryGate.signal()

        #expect(!(await deletion.value))
        #expect(store.items == [item])
        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        #expect(manifest.saveAttempts == 0)
    }

    @Test("A newer on-disk index fails closed")
    func newerManifestFailsClosed() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let future = AudioLibraryIndex(
            version: AudioLibraryIndex.currentVersion + 1,
            items: []
        )
        try JSONEncoder().encode(future).write(to: AudioLibraryFolder.indexURL)
        let unknown = AudioLibraryFolder.fileURL(named: "future-owned.m4a")
        try Data("future bytes".utf8).write(to: unknown)
        let importer = BlockingAudioImporter()
        let store = AudioLibraryStore(importer: importer)

        do {
            _ = try await store.add([unknown])
            Issue.record("A future catalog was overwritten")
        } catch {
            #expect(error.localizedDescription.contains("unreadable"))
        }
        #expect(await importer.calls == 0)
        #expect(FileManager.default.fileExists(atPath: unknown.path))
    }

    @Test("Duplicate catalog identities fail closed without starting recovery")
    func duplicateIDsFailClosed() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let id = UUID()
        let first = SavedAudio(
            id: id, name: "First", kind: .effect, fileName: "first.m4a",
            duration: 1, contentHash: "first"
        )
        let second = SavedAudio(
            id: id, name: "Second", kind: .music, fileName: "second.m4a",
            duration: 2, contentHash: "second"
        )
        let store = AudioLibraryStore(
            manifest: TestAudioLibraryManifest(index: AudioLibraryIndex(items: [first, second]))
        )

        #expect(store.items.isEmpty)
        #expect(!store.isRecovering)
        #expect(store.errorMessage?.contains("could not be read") == true)
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.directory.path))
    }

    @Test("Case-insensitive duplicate catalog filenames fail closed")
    func duplicateFileNamesFailClosed() {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let first = SavedAudio(
            name: "First", kind: .effect, fileName: "Sound.m4a",
            duration: 1, contentHash: "first"
        )
        let second = SavedAudio(
            name: "Second", kind: .effect, fileName: "sound.m4a",
            duration: 1, contentHash: "second"
        )
        let store = AudioLibraryStore(
            manifest: TestAudioLibraryManifest(index: AudioLibraryIndex(items: [first, second]))
        )

        #expect(store.items.isEmpty)
        #expect(!store.isRecovering)
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.directory.path))
    }

    @Test("Catalog traversal fails closed without touching an outside sentinel")
    func catalogTraversalCannotEscape() throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let sentinel = AudioLibraryFolder.directory.deletingLastPathComponent()
            .appending(path: "audio-library-sentinel-\(UUID().uuidString)")
        try Data("outside".utf8).write(to: sentinel)
        defer { try? FileManager.default.removeItem(at: sentinel) }
        let traversal = SavedAudio(
            name: "Traversal", kind: .effect, fileName: "../\(sentinel.lastPathComponent)",
            duration: 1, contentHash: "traversal"
        )

        let store = AudioLibraryStore(
            manifest: TestAudioLibraryManifest(index: AudioLibraryIndex(items: [traversal]))
        )

        #expect(store.items.isEmpty)
        #expect((try? Data(contentsOf: sentinel)) == Data("outside".utf8))
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.directory.path))
    }

    @Test("Candidate traversal fails closed without filesystem recovery mutations")
    func candidateTraversalCannotEscape() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let sentinel = AudioLibraryFolder.directory.deletingLastPathComponent()
            .appending(path: "candidate-sentinel-\(UUID().uuidString)")
        try Data("outside candidate".utf8).write(to: sentinel)
        defer { try? FileManager.default.removeItem(at: sentinel) }
        let item = SavedAudio(
            name: "Candidate", kind: .effect, fileName: "candidate.m4a",
            duration: 1, contentHash: "candidate"
        )
        let candidate = AudioLibraryImportCandidate(
            item: item,
            stagedFileName: "../\(sentinel.lastPathComponent)"
        )
        try JSONEncoder().encode(candidate).write(to: AudioLibraryFolder.importCandidateURL)
        let residue = AudioLibraryFolder.stagedURL(fileName: "must-remain.m4a")
        try Data("residue".utf8).write(to: residue)
        let store = AudioLibraryStore(manifest: TestAudioLibraryManifest(index: AudioLibraryIndex()))

        await store.waitForRecovery()

        #expect(store.items.isEmpty)
        #expect(store.errorMessage?.contains("unfinished audio import") == true)
        #expect((try? Data(contentsOf: sentinel)) == Data("outside candidate".utf8))
        #expect(FileManager.default.fileExists(atPath: residue.path))
        #expect(FileManager.default.fileExists(atPath: AudioLibraryFolder.importCandidateURL.path))
    }

    @Test("Startup restores indexed tombstones and sweeps transaction residue")
    func startupReconcilesTransactionResidue() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let item = SavedAudio(
            name: "Restore", kind: .effect, fileName: "restore.m4a",
            duration: 1, contentHash: "restore"
        )
        let tombstone = AudioLibraryFolder.tombstoneURL(for: item)
        try Data("audio".utf8).write(to: tombstone)
        let staged = AudioLibraryFolder.stagedURL(fileName: "abandoned.m4a")
        try Data("partial".utf8).write(to: staged)
        let manifest = TestAudioLibraryManifest(index: AudioLibraryIndex(items: [item]))
        let store = AudioLibraryStore(manifest: manifest)

        await store.setKind(item.kind, for: item.id)

        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        #expect(!FileManager.default.fileExists(atPath: tombstone.path))
        #expect(!FileManager.default.fileExists(atPath: staged.path))
        #expect(!store.missingIDs.contains(item.id))
    }

    @Test("Startup completes an import candidate left in staging")
    func startupCompletesStagedCandidate() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let item = SavedAudio(
            name: "Staged crash", kind: .effect, fileName: "staged-crash.m4a",
            duration: 1, contentHash: "staged-crash"
        )
        let staged = AudioLibraryFolder.stagedURL(fileName: item.fileName)
        try Data("recover staged".utf8).write(to: staged)
        try AudioLibraryCandidateStore().save(AudioLibraryImportCandidate(
            item: item,
            stagedFileName: staged.lastPathComponent
        ))
        let manifest = TestAudioLibraryManifest(index: AudioLibraryIndex())
        let store = AudioLibraryStore(manifest: manifest)

        await store.waitForRecovery()

        #expect(store.items == [item])
        #expect(manifest.index?.items == [item])
        #expect(manifest.saveAttempts == 1, "recovery must publish its result exactly once")
        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        #expect(!FileManager.default.fileExists(atPath: staged.path))
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.importCandidateURL.path))
    }

    @Test("Startup completes an import candidate already promoted to final")
    func startupCompletesPromotedCandidate() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let item = SavedAudio(
            name: "Final crash", kind: .music, fileName: "final-crash.m4a",
            duration: 2, contentHash: "final-crash"
        )
        try Data("recover final".utf8).write(to: AudioLibraryFolder.url(for: item))
        try AudioLibraryCandidateStore().save(AudioLibraryImportCandidate(
            item: item,
            stagedFileName: "missing-stage.m4a"
        ))
        let manifest = TestAudioLibraryManifest(index: AudioLibraryIndex())
        let store = AudioLibraryStore(manifest: manifest)

        await store.waitForRecovery()

        #expect(store.items == [item])
        #expect(manifest.index?.items == [item])
        #expect(manifest.saveAttempts == 1, "recovery must publish its result exactly once")
        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        #expect(!FileManager.default.fileExists(atPath: AudioLibraryFolder.importCandidateURL.path))
    }

    @Test("Unknown final bytes are quarantined rather than deleted")
    func unknownFinalIsQuarantined() async throws {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let unknown = AudioLibraryFolder.fileURL(named: "crash-orphan.m4a")
        try Data("preserve me".utf8).write(to: unknown)
        let store = AudioLibraryStore(manifest: TestAudioLibraryManifest())

        _ = try await store.add([])

        #expect(!FileManager.default.fileExists(atPath: unknown.path))
        let recovered = try FileManager.default.contentsOfDirectory(
            at: AudioLibraryFolder.recoveredDirectory,
            includingPropertiesForKeys: nil
        )
        #expect(recovered.contains { (try? Data(contentsOf: $0)) == Data("preserve me".utf8) })
    }

    private func seededStore(
        named fileName: String
    ) throws -> (SavedAudio, TestAudioLibraryManifest, AudioLibraryStore) {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        AudioLibraryFolder.ensureTransactionDirectories()
        let item = SavedAudio(
            name: "Seed", kind: .music, fileName: fileName,
            duration: 2, contentHash: UUID().uuidString
        )
        try Data("audio".utf8).write(to: AudioLibraryFolder.url(for: item))
        let manifest = TestAudioLibraryManifest(index: AudioLibraryIndex(items: [item]))
        return (item, manifest, AudioLibraryStore(manifest: manifest))
    }
}

@Suite
struct AudioLibraryNamingTests {
    @Test("A marketplace file name becomes something readable")
    func cleansDownloadedNames() {
        #expect(
            AudioLibraryNaming.displayName(
                for: URL(fileURLWithPath: "/tmp/mixkit-fast-swoosh-1493-[AudioTrimmer].mp3")
            ) == "Mixkit fast swoosh"
        )
        #expect(
            AudioLibraryNaming.displayName(for: URL(fileURLWithPath: "/tmp/my_intro_bed.wav"))
                == "My intro bed"
        )
    }

    @Test("A name with nothing left in it still says something")
    func namesTheUnnameable() {
        #expect(
            AudioLibraryNaming.displayName(for: URL(fileURLWithPath: "/tmp/[].mp3"))
                == "Untitled audio"
        )
    }

    @Test("A taken file name gets a suffix rather than the other file's bytes")
    func avoidsCollisions() {
        let url = URL(fileURLWithPath: "/tmp/pop.mp3")
        #expect(AudioLibraryNaming.uniqueFileName(for: url, taken: []) == "pop.mp3")
        #expect(AudioLibraryNaming.uniqueFileName(for: url, taken: ["pop.mp3"]) == "pop-2.mp3")
        #expect(
            AudioLibraryNaming.uniqueFileName(for: url, taken: ["pop.mp3", "pop-2.mp3"])
                == "pop-3.mp3"
        )
    }

    @Test("File names are safe for the disk they land on")
    func sanitizesNames() {
        let name = AudioLibraryNaming.uniqueFileName(
            for: URL(fileURLWithPath: "/tmp/why: not/ this?.mp3"),
            taken: []
        )
        #expect(!name.contains(":"))
        #expect(!name.contains("?"))
        #expect(name.hasSuffix(".mp3"))
    }

    @Test("Long files land on the music shelf, short ones on effects")
    func guessesKind() {
        #expect(SavedAudioKind.guessed(fromDuration: 0.4) == .effect)
        #expect(SavedAudioKind.guessed(fromDuration: 92) == .music)
    }
}
