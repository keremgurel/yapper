@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct ExportProgressTests {
    @Test("A real render reports progress from 0 to 1 without going backwards")
    func renderReportsProgress() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-export-progress-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        let output = directory.appending(path: "output.mp4")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.8, green: 0.3, blue: 0.1, alpha: 1),
            // Long enough for several progress samples at 250 ms each.
            size: CGSize(width: 1280, height: 720),
            seconds: 8,
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: media.duration)]
        )
        let recorder = ProgressRecorder()

        try await ExportService.export(project: project, to: output) { fraction in
            recorder.record(fraction)
        }

        let values = recorder.values()
        #expect(values.first == 0)
        #expect(values.last == 1)
        #expect(zip(values, values.dropFirst()).allSatisfy { $0 < $1 })
        #expect(values.count > 2)
        #expect(values.allSatisfy { (0 ... 1).contains($0) })
        #expect(try await AVURLAsset(url: output).load(.isPlayable))
    }

    @Test("Two passes share one bar")
    func passesShareTheBar() {
        let recorder = ProgressRecorder()
        let first = ExportPassProgress(span: 0 ... ExportPassProgress.compositedShare, report: { recorder.record($0) })
        let second = ExportPassProgress(span: ExportPassProgress.compositedShare ... 1, report: { recorder.record($0) })
        first.report(0)
        first.report(1)
        second.report(0.5)
        second.report(.nan)
        second.report(2)
        #expect(recorder.values() == [0, 0.75, 0.875, 0.75, 1])
    }
}

private final class ProgressRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [Double] = []
    func record(_ value: Double) { lock.withLock { recorded.append(value) } }
    func values() -> [Double] { lock.withLock { recorded } }
}
