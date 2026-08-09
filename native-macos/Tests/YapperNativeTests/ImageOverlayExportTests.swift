@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// An image overlay is drawn by the canvas while editing and burned in by Core
/// Animation on export, from opposite ends of the frame: the canvas measures
/// down from the top, Core Animation up from the bottom. This exports one over
/// real camera footage and checks it came out of the corner it was put in.
///
/// Skipped when the reference card is not mounted, like the other integration
/// tests. AVAssetExportSession refuses synthetic test movies, so the check
/// needs a real recording to run against.
@Suite(.serialized)
struct ImageOverlayExportTests {
    private static let referenceURL = URL(
        filePath: "/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260801210742_0340_D.MP4"
    )

    @Test(
        "An image overlay is burned in where it was placed",
        .enabled(if: FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func anImageOverlayIsBurnedInWhereItWasPlaced() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-image-overlay-tests")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let imageURL = directory.appending(path: "card.png")
        let outputURL = directory.appending(path: "burned.mp4")
        try writeSolidPNG(color: .blue, size: CGSize(width: 320, height: 180), to: imageURL)

        let video = try await MediaProbe.inspect(url: Self.referenceURL)
        let card = try await MediaProbe.inspect(url: imageURL)
        let project = EditorProject(
            name: "Image overlay export",
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
                    // 16:9 media in a 16:9 box on a landscape frame.
                    height: 0.5
                ),
            ],
            aspectRatio: .source
        )

        try await ExportService.export(project: project, to: outputURL)

        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let frame = try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )

        // The card fills the top right quarter and nothing else.
        let topRight = frame.sample(x: frame.width * 3 / 4, y: frame.height / 4)
        let bottomLeft = frame.sample(x: frame.width / 4, y: frame.height * 3 / 4)
        let topLeft = frame.sample(x: frame.width / 8, y: frame.height / 4)
        #expect(topRight?.isMostlyBlue == true)
        #expect(bottomLeft?.isMostlyBlue == false)
        #expect(topLeft?.isMostlyBlue == false)
    }

    @Test(
        "A cropped image overlay burns in only the part that was kept",
        .enabled(if: FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func aCroppedImageOverlayBurnsInOnlyWhatWasKept() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-cropped-image-tests")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let imageURL = directory.appending(path: "split.png")
        let outputURL = directory.appending(path: "cropped.mp4")
        try writeSplitPNG(
            left: .red,
            right: .blue,
            size: CGSize(width: 320, height: 180),
            to: imageURL
        )

        let video = try await MediaProbe.inspect(url: Self.referenceURL)
        let card = try await MediaProbe.inspect(url: imageURL)
        let project = EditorProject(
            name: "Cropped image overlay",
            media: [video, card],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 22)],
            overlays: [
                ProjectOverlay(
                    mediaID: card.id,
                    timelineStart: 0,
                    duration: 2,
                    x: 0.25,
                    y: 0.25,
                    width: 0.5,
                    height: 0.5,
                    // Keep the blue half only.
                    crop: OverlayCrop(x: 0.5, y: 0, width: 0.5, height: 1)
                ),
            ],
            aspectRatio: .source
        )

        try await ExportService.export(project: project, to: outputURL)

        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let frame = try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )

        // The box sits in the middle of the frame; every part of it is blue,
        // and the red half is nowhere on screen.
        let left = frame.sample(x: frame.width * 2 / 5, y: frame.height / 2)
        let right = frame.sample(x: frame.width * 3 / 5, y: frame.height / 2)
        #expect(left?.isMostlyBlue == true)
        #expect(right?.isMostlyBlue == true)
        #expect(left?.isMostlyRed == false)
        #expect(right?.isMostlyRed == false)
    }

    private func writeSplitPNG(
        left: NSColor,
        right: NSColor,
        size: CGSize,
        to url: URL
    ) throws {
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
        left.setFill()
        NSBezierPath(rect: CGRect(x: 0, y: 0, width: size.width / 2, height: size.height)).fill()
        right.setFill()
        NSBezierPath(
            rect: CGRect(x: size.width / 2, y: 0, width: size.width / 2, height: size.height)
        ).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: url)
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
