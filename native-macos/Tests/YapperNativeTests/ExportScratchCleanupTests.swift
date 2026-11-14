@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// Every file an export writes outside its destination has to be gone when it
/// ends, whether it delivered, failed or was cancelled. What a dead process
/// leaves behind is swept at the next launch, and only once nothing holds it.
@Suite(.serialized)
struct ExportScratchCleanupTests {
    @Test("A two-pass export leaves nothing in its scratch folder")
    func twoPassExportCleansUp() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let project = try await gradedProject(in: root, seconds: 0.5)
        let built = try await CompositionBuilder.build(project: project)
        #expect(built.videoComposition?.customVideoCompositorClass != nil)
        #expect(built.videoComposition?.animationTool != nil)

        let scratch = root.appending(path: "scratch", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
        let output = root.appending(path: "graded.mp4")
        try await ExportService.export(
            project: project,
            to: output,
            maximumRenderDimension: nil,
            scratchRoot: scratch
        )

        #expect(try await AVURLAsset(url: output).load(.isPlayable))
        #expect(try contents(of: scratch).isEmpty)
    }

    @Test("A finished export lets go of its private copies")
    func exportClosesItsCopies() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let project = try await gradedProject(in: root, seconds: 0.5)
        let scratch = root.appending(path: "scratch", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)

        try await ExportService.export(
            project: project,
            to: root.appending(path: "graded.mp4"),
            maximumRenderDimension: nil,
            scratchRoot: scratch
        )

        // A deleted file that is still open keeps its blocks. For a clone of
        // footage the creator later deletes, that is the whole recording.
        #expect(openFiles(under: scratch).isEmpty)
    }

    @Test("A failed export leaves nothing in its scratch folder")
    func failedExportCleansUp() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let project = try await gradedProject(in: root, seconds: 0.5)
        let scratch = root.appending(path: "scratch", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
        // A folder where the file should go: the render runs to the end and
        // delivery is what fails.
        let output = root.appending(path: "taken.mp4", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

        await #expect(throws: (any Error).self) {
            try await ExportService.export(
                project: project,
                to: output,
                maximumRenderDimension: nil,
                scratchRoot: scratch
            )
        }
        #expect(try contents(of: scratch).isEmpty)
    }

    @Test("A cancelled export leaves nothing in its scratch folder")
    func cancelledExportCleansUp() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let project = try await gradedProject(in: root, seconds: 4)
        let scratch = root.appending(path: "scratch", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
        let output = root.appending(path: "cancelled.mp4")
        let started = RenderStartGate()

        let task = Task {
            try await ExportService.export(
                project: project,
                to: output,
                maximumRenderDimension: nil,
                scratchRoot: scratch,
                progress: { _ in Task { await started.signal() } }
            )
        }
        await started.waitUntilStarted()
        task.cancel()
        _ = await task.result

        #expect(!FileManager.default.fileExists(atPath: output.path))
        #expect(try contents(of: scratch).isEmpty)
    }

    @Test("The launch sweep removes abandoned scratch and leaves the rest alone")
    func sweepRemovesOnlyAbandonedScratch() throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let old = Date(timeIntervalSinceNow: -(25 * 60 * 60))

        // From a process that died: its lock file is there but nobody holds it.
        let abandoned = try makeFolder("yapper-export-snapshot-abandoned", in: root)
        try ExportScratchLock.hold(in: abandoned).release()
        // From a build before the lock file existed.
        let unmarked = try makeFolder("yapper-export-snapshot-unmarked", in: root)
        // A long export that is still running.
        let running = try makeFolder("yapper-export-snapshot-running", in: root)
        let runningLock = try ExportScratchLock.hold(in: running)
        defer { runningLock.release() }
        // Started a moment ago.
        let fresh = try makeFolder("yapper-export-snapshot-fresh", in: root)
        // What older builds wrote straight into the temp folder.
        let legacy = root.appending(path: "yapper-composited-legacy.mp4")
        let partial = root.appending(path: "yapper-composited-legacy.mp4.sb-3f166dd0-ZMhP0E")
        let recentLegacy = root.appending(path: "yapper-composited-recent.mp4")
        let unrelated = root.appending(path: "someone-elses-file.mp4")
        for file in [legacy, partial, recentLegacy, unrelated] {
            try Data("render".utf8).write(to: file)
        }
        for item in [abandoned, unmarked, running, legacy, partial, unrelated] {
            try FileManager.default.setAttributes([.modificationDate: old], ofItemAtPath: item.path)
        }

        StaleExportScratchSweeper.sweep(in: root)

        let remaining = Set(try contents(of: root))
        #expect(remaining == [
            running.lastPathComponent,
            fresh.lastPathComponent,
            recentLegacy.lastPathComponent,
            unrelated.lastPathComponent,
        ])
    }

    @Test("A live snapshot cannot be claimed until it is discarded")
    func liveSnapshotHoldsItsLock() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appending(path: "source.mov")
        try Data("source".utf8).write(to: source)
        let media = ProjectMedia(url: source, name: "Source", duration: 1, width: 16, height: 9, hasAudio: false)
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        )

        let snapshot = try await ExportSourceSnapshot.create(project: project, root: root)
        guard case .inUse = ExportScratchLock.claim(snapshot.directory) else {
            Issue.record("A sweep could claim a snapshot that an export still holds.")
            return
        }
        snapshot.discard()
        #expect(!FileManager.default.fileExists(atPath: snapshot.directory.path))
    }

    @Test("Snapshot copies are clones of the source, not full copies")
    func snapshotCopiesAreClones() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appending(path: "source.mov")
        try Data(repeating: 0x5A, count: 8 * 1024 * 1024).write(to: source)
        let media = ProjectMedia(url: source, name: "Source", duration: 1, width: 16, height: 9, hasAudio: false)
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        )

        let snapshot = try await ExportSourceSnapshot.create(project: project, root: root)
        defer { snapshot.discard() }

        // A clone shares its blocks with the source until either is written,
        // so the copy adds nothing to the volume's private size.
        let copy = snapshot.project.media[0].url
        let keys: Set<URLResourceKey> = [.mayShareFileContentKey]
        #expect(try copy.resourceValues(forKeys: keys).mayShareFileContent == true)
    }

    @Test("Forgetting a folder drops only the cached files inside it")
    func cacheForgetsOnlyTheFolder() async throws {
        let root = try scratchTestDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let inside = root.appending(path: "export", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: inside, withIntermediateDirectories: true)
        let insideURL = inside.appending(path: "copy.mov")
        let outsideURL = root.appending(path: "original.mov")
        for url in [insideURL, outsideURL] {
            try await SyntheticVideo.write(
                color: CGColor(red: 0.3, green: 0.3, blue: 0.3, alpha: 1),
                size: CGSize(width: 64, height: 36),
                seconds: 0.2,
                to: url
            )
        }
        let cache = CompositionSourceCache()
        for url in [insideURL, outsideURL] {
            _ = try await cache.source(for: try await MediaProbe.inspect(url: url))
        }
        #expect(cache.cachedEntryCount == 2)

        cache.forget(filesIn: inside)

        #expect(cache.cachedEntryCount == 1)
    }

    private func gradedProject(in directory: URL, seconds: Double) async throws -> EditorProject {
        let source = directory.appending(path: "source.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.2, green: 0.4, blue: 0.6, alpha: 1),
            size: CGSize(width: 320, height: 180),
            seconds: seconds,
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        return EditorProject(
            name: "Scratch cleanup",
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: media.duration)],
            textLayers: [
                ProjectTextLayer(
                    text: "Graded",
                    timelineStart: 0,
                    duration: media.duration,
                    y: 0.8,
                    appearance: .hookDefault
                ),
            ],
            aspectRatio: .source,
            visualFilter: VisualFilter(id: .mono, strength: 1)
        )
    }

    private func makeFolder(_ name: String, in root: URL) throws -> URL {
        let url = root.appending(path: name, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Paths this process holds open inside `directory`, deleted or not.
    private func openFiles(under directory: URL) -> [String] {
        // `resolvingSymlinksInPath` strips the `/private` that the kernel
        // reports for the temp folder, so ask for the real path instead.
        guard let real = realpath(directory.path, nil) else { return [] }
        defer { free(real) }
        let folder = String(cString: real) + "/"
        var buffer = [CChar](repeating: 0, count: Int(MAXPATHLEN))
        return (0 ..< getdtablesize()).compactMap { descriptor in
            guard fcntl(descriptor, F_GETPATH, &buffer) != -1 else { return nil }
            let path = String(cString: buffer)
            return path.hasPrefix(folder) ? path : nil
        }
    }

    private func contents(of directory: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path)
    }
}

private actor RenderStartGate {
    private var started = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func signal() {
        guard !started else { return }
        started = true
        let pending = waiters
        waiters.removeAll()
        for waiter in pending { waiter.resume() }
    }

    func waitUntilStarted() async {
        guard !started else { return }
        await withCheckedContinuation { waiters.append($0) }
    }
}

private func scratchTestDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
        path: "export-scratch-tests-\(UUID().uuidString)",
        directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}
