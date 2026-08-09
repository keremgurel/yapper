@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A graded project is composited by the editor's own compositor, while text
/// and image overlays are still burned in by Core Animation afterwards. Those
/// two have to work together, or grading a video would quietly drop everything
/// laid over it.
@Suite(.serialized)
struct FilteredExportTests {
    private static let referenceURL = URL(
        filePath: "/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260801210742_0340_D.MP4"
    )

    @Test(
        "A graded export still burns in its overlays and captions",
        .enabled(if: FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func aGradedExportKeepsEverythingLaidOverIt() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-filtered-export-tests")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let imageURL = directory.appending(path: "card.png")
        let outputURL = directory.appending(path: "graded.mp4")
        try writeSolidPNG(color: .blue, size: CGSize(width: 320, height: 180), to: imageURL)

        let video = try await MediaProbe.inspect(url: Self.referenceURL)
        let card = try await MediaProbe.inspect(url: imageURL)
        let project = EditorProject(
            name: "Graded export",
            media: [video, card],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 22)],
            overlays: [
                ProjectOverlay(
                    mediaID: card.id,
                    timelineStart: 0,
                    duration: 2,
                    x: 0.5,
                    y: 0,
                    width: 0.5,
                    height: 0.5
                ),
            ],
            textLayers: [
                ProjectTextLayer(
                    text: "Graded",
                    timelineStart: 0,
                    duration: 2,
                    y: 0.8,
                    appearance: .hookDefault
                ),
            ],
            aspectRatio: .source,
            visualFilter: VisualFilter(id: .mono, strength: 1)
        )

        let built = try await CompositionBuilder.build(project: project)
        // Both passes are in play: the editor's compositor and the layer tree.
        #expect(built.videoComposition?.customVideoCompositorClass != nil)
        #expect(built.videoComposition?.animationTool != nil)

        try await ExportService.export(project: project, to: outputURL)

        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let frame = try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )

        // The overlay is still there, and graded with the footage: mono takes
        // the blue out of it, which is exactly what the browser does.
        let overlay = frame.sample(x: frame.width * 3 / 4, y: frame.height / 4)
        #expect(overlay != nil)
        #expect(overlay?.isMostlyBlue == false)
        #expect(abs((overlay?.red ?? 0) - (overlay?.blue ?? 0)) < 40)

        // And the footage under it came out grey rather than in colour.
        let footage = frame.sample(x: frame.width / 5, y: frame.height * 3 / 4)
        #expect(footage != nil)
        #expect(abs((footage?.red ?? 0) - (footage?.blue ?? 0)) < 40)
    }

    private func writeSolidPNG(color: NSColor, size: CGSize, to url: URL) throws {
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int(size.width),
            pixelsHigh: Int(size.height),
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
        NSBezierPath(rect: CGRect(origin: .zero, size: size)).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: url)
    }
}
