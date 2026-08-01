@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private let djiReferenceURL = URL(
    filePath: "/Volumes/G Micro Pro/DCIM/DJI_001/DJI_20260719173505_0045_D.MP4"
)

@Suite(.serialized)
struct ReferenceMediaIntegrationTests {
    @Test(
        "DJI source builds a 50-cut continuous composition",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func buildsContinuousComposition() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        let clipLength = 0.8
        let clips = (0 ..< 50).map { index in
            let start = 20.0 + Double(index) * 1.1
            return TimelineClip(
                mediaID: media.id,
                sourceStart: start,
                sourceEnd: start + clipLength
            )
        }
        let project = EditorProject(name: "DJI benchmark", media: [media], clips: clips)

        let clock = ContinuousClock()
        let start = clock.now
        let built = try await CompositionBuilder.build(project: project)
        let elapsed = start.duration(to: clock.now)
        let videoTracks = try await built.asset.loadTracks(withMediaType: .video)
        let audioTracks = try await built.asset.loadTracks(withMediaType: .audio)

        #expect(videoTracks.count == 1)
        #expect(audioTracks.count == 1)
        // Camera video samples land on encoded frame boundaries. Across 50
        // inserts the aggregate rounding stays below one tenth of a second.
        #expect(abs(built.asset.duration.seconds - 40) < 0.1)
        #expect(elapsed < .seconds(2))
    }

    @Test(
        "DJI cut export contains synchronized audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsAudioAndVideo() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        let project = EditorProject(
            name: "DJI export check",
            media: [media],
            clips: [
                TimelineClip(mediaID: media.id, sourceStart: 20, sourceEnd: 22),
                TimelineClip(mediaID: media.id, sourceStart: 24, sourceEnd: 26),
                TimelineClip(mediaID: media.id, sourceStart: 28, sourceEnd: 30),
            ]
        )
        let output = FileManager.default.temporaryDirectory
            .appending(path: "yapper-native-reference-export.mp4")
        defer { try? FileManager.default.removeItem(at: output) }

        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        let videoTracks = try await rendered.loadTracks(withMediaType: .video)
        let audioTracks = try await rendered.loadTracks(withMediaType: .audio)
        let duration = try await rendered.load(.duration).seconds
        #expect(videoTracks.count == 1)
        #expect(audioTracks.count == 1)
        #expect(abs(duration - 6) < 0.15)
        #expect((try FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int ?? 0) > 0)
    }

    @Test(
        "DJI export renders an image overlay without losing audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsImageOverlay() async throws {
        let video = try await MediaProbe.inspect(url: djiReferenceURL)
        let imageURL = FileManager.default.temporaryDirectory.appending(path: "yapper-overlay-check.png")
        let output = FileManager.default.temporaryDirectory.appending(path: "yapper-overlay-check.mp4")
        defer {
            try? FileManager.default.removeItem(at: imageURL)
            try? FileManager.default.removeItem(at: output)
        }

        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: 320,
            pixelsHigh: 180,
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
        NSColor.magenta.setFill()
        NSBezierPath(rect: CGRect(x: 0, y: 0, width: 320, height: 180)).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: imageURL)

        let image = try await MediaProbe.inspect(url: imageURL)
        let project = EditorProject(
            name: "Overlay export check",
            media: [video, image],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 24)],
            overlays: [ProjectOverlay(mediaID: image.id, timelineStart: 0.5, duration: 2)]
        )
        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
        #expect(try await rendered.loadTracks(withMediaType: .audio).count == 1)
        #expect(abs(try await rendered.load(.duration).seconds - 4) < 0.15)
    }
}
