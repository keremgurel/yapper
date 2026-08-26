@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// A rendered file existing is not proof that its captions were burned in.
/// This samples the output pixels so an invisible Core Animation layer fails
/// the test instead of shipping as a plausible-looking video.
@Suite(.serialized)
struct CaptionExportPixelTests {
    private static let referenceURL = URL(
        filePath: "/Volumes/G Micro Pro/DCIM/DJI_001/DJI_20260826061333_0063_D.MP4"
    )

    @Test(
        "A caption is visibly burned into its timed export window",
        .enabled(if: FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func captionPixelsExistOnlyDuringTheCue() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-caption-pixel-tests")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let outputURL = directory.appending(path: "captioned.mp4")
        let video = try await MediaProbe.inspect(url: Self.referenceURL)
        let clip = TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 2)
        let appearance = TextAppearance(
            fontScale: 0.08,
            color: StudioColor(red: 1, green: 0, blue: 1),
            backgroundEnabled: false,
            shadowEnabled: false
        )
        let project = EditorProject(
            name: "Caption pixel check",
            media: [video],
            clips: [clip],
            transcript: [
                TranscriptWord(mediaID: video.id, text: "VISIBLE", start: 0.4, end: 1.4),
            ],
            captionsEnabled: true,
            captionStyle: TextStyle(y: 0.5, appearance: appearance),
            visualFilter: VisualFilter(id: .mono, strength: 1)
        )

        try await ExportService.export(project: project, to: outputURL)
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let before = try generator.copyCGImage(
            at: CMTime(seconds: 0.1, preferredTimescale: 600),
            actualTime: nil
        )
        let during = try generator.copyCGImage(
            at: CMTime(seconds: 0.8, preferredTimescale: 600),
            actualTime: nil
        )

        #expect(magentaSamples(in: during) > magentaSamples(in: before) + 100)
    }

    private func magentaSamples(in image: CGImage) -> Int {
        stride(from: 0, to: image.height, by: 8).reduce(into: 0) { count, y in
            for x in stride(from: 0, to: image.width, by: 8) {
                guard let pixel = image.sample(x: x, y: y) else { continue }
                if pixel.red > 180, pixel.blue > 180, pixel.green < 100 {
                    count += 1
                }
            }
        }
    }
}
