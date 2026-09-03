@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import YapperNative

@Suite(.serialized)
struct AnimatedImageCropExportTests {
    @Test func independentCropsAndKeyframedPanZoomRenderInPreviewAndExport() async throws {
        let retained = ProcessInfo.processInfo.environment["YAPPER_CROP_QA_DIRECTORY"]
        let directory = retained.map { URL(filePath: $0) }
            ?? FileManager.default.temporaryDirectory.appending(path: "crop-motion-\(UUID())")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { if retained == nil { try? FileManager.default.removeItem(at: directory) } }
        let videoURL = directory.appending(path: "base.mov")
        let imageURL = directory.appending(path: "red-blue.png")
        let outputURL = directory.appending(path: "result.mp4")
        try await SyntheticVideo.write(color: NSColor.green.cgColor,
            size: CGSize(width: 320, height: 180), seconds: 4, to: videoURL)
        let context = try #require(CGContext(data: nil, width: 200, height: 100,
            bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(NSColor.red.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
        context.setFillColor(NSColor.blue.cgColor)
        context.fill(CGRect(x: 100, y: 0, width: 100, height: 100))
        let image = try #require(context.makeImage())
        let destination = try #require(CGImageDestinationCreateWithURL(imageURL as CFURL, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        #expect(CGImageDestinationFinalize(destination))
        let video = try await MediaProbe.inspect(url: videoURL)
        let picture = try await MediaProbe.inspect(url: imageURL)
        let left = OverlayCrop(x: 0, y: 0, width: 0.5, height: 1)
        let right = OverlayCrop(x: 0.5, y: 0.25, width: 0.5, height: 0.5)
        let a = OverlayBox(x: 0.1, y: 0.1, width: 0.3, height: 0.5)
        let b = OverlayBox(x: 0.4, y: 0.25, width: 0.5, height: 0.7)
        let moving = ProjectOverlay(mediaID: picture.id, timelineStart: 0, duration: 2,
            crop: left, track: 1, keys: [OverlayKey(at: 0, box: a, crop: left), OverlayKey(at: 1.5, box: b, crop: right)])
        let still = ProjectOverlay(mediaID: picture.id, timelineStart: 2, duration: 2,
            x: 0.1, y: 0.1, width: 0.4, height: 0.6, crop: left, track: 0)
        let project = EditorProject(media: [video, picture],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 4)],
            overlays: [moving, still], aspectRatio: .source)
        #expect(project.compositedOverlayIDs == [moving.id, still.id])
        #expect(project.needsStudioCompositor)
        let built = try await CompositionBuilder.build(project: project)
        let preview = AVAssetImageGenerator(asset: built.asset)
        preview.videoComposition = built.playbackVideoComposition
        try await ExportService.export(project: project, to: outputURL)
        let exported = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        for generator in [preview, exported] {
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero
            for (time, overlay, blue) in [(0.05, moving, false), (1.75, moving, true), (2.75, still, false)] {
                let frame = try generator.copyCGImage(at: CMTime(seconds: time, preferredTimescale: 600), actualTime: nil)
                let box = OverlayKeyTrack.box(of: overlay, atTimeline: time)
                let x = Int((box.x + box.width / 2) * Double(frame.width))
                let y = Int((box.y + box.height / 2) * Double(frame.height))
                let pixel = try #require(frame.sample(x: x, y: y))
                #expect(blue ? pixel.isMostlyBlue : pixel.isMostlyRed)
                // The original small top-left position is uncovered after the move.
                if time == 1.75 {
                    let outside = try #require(frame.sample(x: frame.width / 8, y: frame.height / 5))
                    #expect(!outside.isMostlyBlue && !outside.isMostlyRed)
                }
            }
        }
        var hiddenMain = project
        hiddenMain.videoTrackHidden = true
        #expect(hiddenMain.compositedOverlayIDs.contains(moving.id))
        #expect(hiddenMain.needsStudioCompositor)
        if retained != nil {
            let package = ProjectPackage(url: directory.appending(path: "Crop keyframe QA.yapperproj"))
            try await ProjectPackageStore(package: package).save(project)
        }
    }
}
