@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct ExportDeliveryTests {
    private static let referenceURL = URL(
        filePath: "/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260801210742_0340_D.MP4"
    )

    private enum ExpectedFailure: Error {
        case stopped
    }

    @Test("A failed export preserves the last successful file")
    func failurePreservesExistingDestination() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let original = Data("last good export".utf8)
        try original.write(to: output)

        var receivedExpectedFailure = false
        do {
            try await StagedFileDelivery.deliver(
                to: output,
                produce: { staged in
                    try Data("incomplete export".utf8).write(to: staged)
                    throw ExpectedFailure.stopped
                },
                validate: { _ in }
            )
        } catch ExpectedFailure.stopped {
            receivedExpectedFailure = true
        }

        #expect(receivedExpectedFailure)
        #expect(try Data(contentsOf: output) == original)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    @Test("Cancellation preserves the last successful file")
    func cancellationPreservesExistingDestination() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let original = Data("last good export".utf8)
        try original.write(to: output)

        let task = Task {
            try await StagedFileDelivery.deliver(
                to: output,
                produce: { staged in
                    try Data("cancelled export".utf8).write(to: staged)
                    withUnsafeCurrentTask { $0?.cancel() }
                },
                validate: { _ in Issue.record("A cancelled export must not be validated.") }
            )
        }

        var wasCancelled = false
        do {
            try await task.value
        } catch is CancellationError {
            wasCancelled = true
        }

        #expect(wasCancelled)
        #expect(try Data(contentsOf: output) == original)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    @Test("A video-only composition does not require rendered audio")
    func videoOnlyCompositionDoesNotRequireAudio() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "silent.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.1, green: 0.2, blue: 0.3, alpha: 1),
            size: CGSize(width: 320, height: 180),
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        let project = EditorProject(
            name: "Silent export",
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 0.9)]
        )

        let built = try await CompositionBuilder.build(project: project, for: .export)
        #expect(!built.hasRenderedAudio)
    }

    @Test(
        "A muted video exports without requiring an audio track",
        .enabled(if: FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func mutedVideoExportSucceeds() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let media = try await MediaProbe.inspect(url: Self.referenceURL)
        let project = EditorProject(
            name: "Muted export",
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 20, sourceEnd: 22)],
            videoTrackMuted: true
        )

        let built = try await CompositionBuilder.build(project: project, for: .export)
        #expect(!built.hasRenderedAudio)
        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
        #expect((try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) > 0)
    }

    @Test("A verified export atomically replaces the previous file")
    func successReplacesExistingDestination() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let replacement = Data("new verified export".utf8)
        try Data("old export".utf8).write(to: output)

        try await StagedFileDelivery.deliver(
            to: output,
            produce: { staged in
                #expect(staged.deletingLastPathComponent() == directory)
                #expect(staged.pathExtension == "mp4")
                try replacement.write(to: staged)
            },
            validate: { staged in
                let currentDestination = try Data(contentsOf: output)
                let stagedData = try Data(contentsOf: staged)
                #expect(currentDestination != replacement)
                #expect(stagedData == replacement)
            }
        )

        #expect(try Data(contentsOf: output) == replacement)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    @Test("A first export is moved into place without staging residue")
    func successCreatesNewDestination() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let rendered = Data("first verified export".utf8)

        try await StagedFileDelivery.deliver(
            to: output,
            produce: { staged in try rendered.write(to: staged) },
            validate: { _ in }
        )

        #expect(try Data(contentsOf: output) == rendered)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    @Test("A validation failure preserves the destination")
    func validationFailurePreservesExistingDestination() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4")
        let original = Data("last good export".utf8)
        try original.write(to: output)

        var receivedExpectedFailure = false
        do {
            try await StagedFileDelivery.deliver(
                to: output,
                produce: { staged in try Data("invalid export".utf8).write(to: staged) },
                validate: { _ in throw ExpectedFailure.stopped }
            )
        } catch ExpectedFailure.stopped {
            receivedExpectedFailure = true
        }

        #expect(receivedExpectedFailure)
        #expect(try Data(contentsOf: output) == original)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    @Test("An existing folder is never replaced by an export")
    func directoryDestinationIsPreserved() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let output = directory.appending(path: "finished.mp4", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

        var failed = false
        do {
            try await StagedFileDelivery.deliver(
                to: output,
                produce: { staged in try Data("valid export".utf8).write(to: staged) },
                validate: { _ in }
            )
        } catch {
            failed = true
        }

        var isDirectory: ObjCBool = false
        #expect(failed)
        #expect(FileManager.default.fileExists(atPath: output.path, isDirectory: &isDirectory))
        #expect(isDirectory.boolValue)
        #expect(try directoryContents(directory) == [output.lastPathComponent])
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-export-delivery-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func directoryContents(_ directory: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ).map(\.lastPathComponent).sorted()
    }
}
