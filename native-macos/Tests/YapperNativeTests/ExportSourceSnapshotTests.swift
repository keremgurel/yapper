@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct ExportSourceSnapshotTests {
    @Test("An export keeps reading its private source after the original path is replaced")
    func sourceReplacementCannotChangeSnapshot() async throws {
        let directory = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        let original = Data(repeating: 0x19, count: 192 * 1024)
        try original.write(to: source)
        let project = try await projectUsing(source)

        let snapshot = try await ExportSourceSnapshot.create(project: project)
        let snapshotURL = snapshot.project.media[0].url
        #expect(snapshotURL != source)
        #expect(try Data(contentsOf: snapshotURL) == original)

        try Data(repeating: 0x73, count: original.count).write(
            to: source,
            options: .atomic
        )
        #expect(try Data(contentsOf: snapshotURL) == original)

        snapshot.discard()
        #expect(!FileManager.default.fileExists(atPath: snapshotURL.path))
    }

    @Test("Only sources that can appear in the export are copied")
    func unusedMediaIsNotSnapshotted() async throws {
        let directory = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let used = directory.appending(path: "used.mov")
        let unused = directory.appending(path: "unused.mov")
        try Data("used".utf8).write(to: used)
        try Data("unused".utf8).write(to: unused)
        let usedMedia = ProjectMedia(
            url: used,
            name: "Used",
            duration: 1,
            width: 16,
            height: 9,
            hasAudio: false
        )
        let unusedMedia = ProjectMedia(
            url: unused,
            name: "Unused",
            duration: 1,
            width: 16,
            height: 9,
            hasAudio: false
        )
        let project = EditorProject(
            media: [usedMedia, unusedMedia],
            clips: [TimelineClip(mediaID: usedMedia.id, sourceStart: 0, sourceEnd: 1)]
        )
        let counter = CopyCounter()

        let snapshot = try await ExportSourceSnapshot.create(
            project: project,
            copy: { source, destination in
                await counter.record(source)
                try FileManager.default.copyItem(at: source, to: destination)
            }
        )
        defer { snapshot.discard() }

        #expect(await counter.sources == [used])
        #expect(snapshot.project.media[0].url != used)
        #expect(snapshot.project.media[1].url == unused)
    }

    @Test("A source replacement during snapshot creation fails closed")
    func replacementDuringCopyIsRejected() async throws {
        let directory = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        let original = Data(repeating: 0x28, count: 192 * 1024)
        try original.write(to: source)
        let project = try await projectUsing(source)
        var rejected = false

        do {
            _ = try await ExportSourceSnapshot.create(
                project: project,
                copy: { source, destination in
                    try Data(repeating: 0x42, count: original.count).write(
                        to: source,
                        options: .atomic
                    )
                    try FileManager.default.copyItem(at: source, to: destination)
                }
            )
        } catch let error as NativeEditorError {
            guard case let .exportFailed(message) = error else {
                Issue.record("Unexpected native error: \(error)")
                return
            }
            rejected = message.contains("changed while export was starting") ||
                message.contains("no longer matches this project")
        }

        #expect(rejected)
    }

    @Test("Required external audio is private while inactive audio remains untouched")
    func requiredAudioIsSnapshotted() async throws {
        let directory = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let video = directory.appending(path: "video.mov")
        let activeAudio = directory.appending(path: "active.m4a")
        let inactiveAudio = directory.appending(path: "inactive.m4a")
        try Data("video".utf8).write(to: video)
        try Data("active audio".utf8).write(to: activeAudio)
        try Data("inactive audio".utf8).write(to: inactiveAudio)
        let media = ProjectMedia(
            url: video,
            name: "Video",
            duration: 2,
            width: 16,
            height: 9,
            hasAudio: false
        )
        let active = ProjectAudioLayer(
            url: activeAudio,
            name: "Active",
            timelineStart: 0,
            duration: 1,
            sourceKind: .external
        )
        let inactive = ProjectAudioLayer(
            url: inactiveAudio,
            name: "Past the end",
            timelineStart: 3,
            duration: 1,
            sourceKind: .external
        )
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2)],
            audioLayers: [active, inactive]
        )

        let snapshot = try await ExportSourceSnapshot.create(project: project)
        defer { snapshot.discard() }

        #expect(snapshot.project.audioLayers?[0].url != activeAudio)
        #expect(snapshot.project.audioLayers?[1].url == inactiveAudio)
        #expect(
            try Data(contentsOf: snapshot.project.audioLayers![0].url) ==
                Data("active audio".utf8)
        )
    }

    @Test("Abandoned snapshot directories are reclaimed without touching a fresh export")
    func staleSnapshotCleanupIsAgeBounded() async throws {
        let root = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appending(path: "source.mov")
        try Data("source".utf8).write(to: source)
        let stale = root.appending(path: "yapper-export-snapshot-stale")
        let fresh = root.appending(path: "yapper-export-snapshot-fresh")
        try FileManager.default.createDirectory(at: stale, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: fresh, withIntermediateDirectories: true)
        try FileManager.default.setAttributes(
            [.modificationDate: Date(timeIntervalSinceNow: -(25 * 60 * 60))],
            ofItemAtPath: stale.path
        )
        let media = ProjectMedia(
            url: source,
            name: "Source",
            duration: 1,
            width: 16,
            height: 9,
            hasAudio: false
        )
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        )

        let snapshot = try await ExportSourceSnapshot.create(project: project, root: root)
        defer { snapshot.discard() }

        #expect(!FileManager.default.fileExists(atPath: stale.path))
        #expect(FileManager.default.fileExists(atPath: fresh.path))
    }

    @Test("Cancellation removes a partial snapshot before returning")
    func cancellationCleansPartialSnapshot() async throws {
        let root = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appending(path: "source.mov")
        try Data("source".utf8).write(to: source)
        let media = ProjectMedia(
            url: source,
            name: "Source",
            duration: 1,
            width: 16,
            height: 9,
            hasAudio: false
        )
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        )
        let gate = CopyStartGate()
        let task = Task {
            try await ExportSourceSnapshot.create(
                project: project,
                root: root,
                copy: { _, destination in
                    try Data("partial".utf8).write(to: destination)
                    await gate.signal()
                    try await Task.sleep(for: .seconds(60))
                }
            )
        }
        await gate.waitUntilStarted()
        task.cancel()

        var wasCancelled = false
        do {
            _ = try await task.value
        } catch is CancellationError {
            wasCancelled = true
        }

        #expect(wasCancelled)
        let residue = try FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: nil
        ).filter { $0.lastPathComponent.hasPrefix("yapper-export-snapshot-") }
        #expect(residue.isEmpty)
    }

    @Test("ExportService renders from the rewritten snapshot URLs")
    func exportServiceConsumesSnapshot() async throws {
        let directory = try snapshotTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        let output = directory.appending(path: "output.mp4")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.2, green: 0.4, blue: 0.6, alpha: 1),
            size: CGSize(width: 160, height: 90),
            seconds: 0.4,
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        let project = EditorProject(
            media: [media],
            clips: [
                TimelineClip(
                    mediaID: media.id,
                    sourceStart: 0,
                    sourceEnd: min(0.35, media.duration)
                ),
            ]
        )

        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.load(.isPlayable))
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
    }

    private func projectUsing(_ source: URL) async throws -> EditorProject {
        let fingerprint = try await MediaSourceFingerprint.compute(url: source)
        let media = ProjectMedia(
            url: source,
            name: source.lastPathComponent,
            duration: 1,
            width: 16,
            height: 9,
            hasAudio: false,
            sourceFingerprint: fingerprint
        )
        return EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)]
        )
    }
}

private actor CopyCounter {
    private(set) var sources: [URL] = []

    func record(_ source: URL) {
        sources.append(source)
    }
}

private actor CopyStartGate {
    private var started = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func signal() {
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

private func snapshotTemporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
        path: "yapper-export-snapshot-tests-\(UUID().uuidString)",
        directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}
