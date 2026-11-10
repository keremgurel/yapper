@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct OverlayBackdropExportTests {
    /// A card with a preset behind it, and one frosted, both rendered by the
    /// player's composition and by a real export: nothing behind the card
    /// before it, the backdrop once it has faded in, the card on top of it.
    @Test func backdropsRenderInPreviewAndExport() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: "backdrop-\(UUID())")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let videoURL = directory.appending(path: "base.mov")
        let cardURL = directory.appending(path: "card.mov")
        let outputURL = directory.appending(path: "result.mp4")
        try await SyntheticVideo.write(color: NSColor.green.cgColor, size: CGSize(width: 180, height: 320), seconds: 6, to: videoURL)
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 160, height: 120), seconds: 6, to: cardURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        let card = try await MediaProbe.inspect(url: cardURL)

        let navy = ProjectOverlay(mediaID: card.id, timelineStart: 1, duration: 2,
            x: 0.25, y: 0.3, width: 0.5, height: 0.2, backdrop: .preset(.navyGlow))
        let frosted = ProjectOverlay(mediaID: card.id, timelineStart: 3.5, duration: 2, sourceStart: 0,
            x: 0.25, y: 0.3, width: 0.5, height: 0.2, backdrop: .frosted)
        let project = EditorProject(media: [video, card],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 6)],
            overlays: [navy, frosted], aspectRatio: .source)
        #expect(project.needsStudioCompositor)

        let built = try await CompositionBuilder.build(project: project)
        let preview = AVAssetImageGenerator(asset: built.asset)
        preview.videoComposition = built.playbackVideoComposition
        try await ExportService.export(project: project, to: outputURL)
        let exported = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))

        for generator in [preview, exported] {
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero
            func pixel(_ seconds: Double, _ u: Double, _ v: Double) throws -> SampledPixel {
                let frame = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
                return try #require(frame.sample(x: Int(u * Double(frame.width)), y: Int(v * Double(frame.height))))
            }
            // Before the card: the speaker, untouched.
            let before = try pixel(0.5, 0.1, 0.1)
            #expect(before.green > 200 && before.red < 60)
            // Navy glow behind the card: dark and blue, the green gone.
            let behindNavy = try pixel(2, 0.1, 0.1)
            #expect(behindNavy.blue > behindNavy.green && behindNavy.green < 120, "navy: \(behindNavy)")
            // The card itself stays on top.
            #expect(try pixel(2, 0.5, 0.4).isMostlyRed)
            // Frosted: still the speaker's colour, a little darker.
            let behindFrost = try pixel(4.5, 0.1, 0.1)
            #expect(behindFrost.green > behindFrost.red + 80 && behindFrost.green < before.green, "frosted: \(behindFrost)")
            #expect(try pixel(4.5, 0.5, 0.4).isMostlyRed)
        }
    }

    /// Remove background with a preset behind: a background swap. A
    /// synthetic clip has nobody in it, so the matte keeps nothing and the
    /// whole frame is the preset.
    @Test func presetFillsBehindARemovedBackground() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: "swap-\(UUID())")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let videoURL = directory.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.green.cgColor, size: CGSize(width: 180, height: 320), seconds: 2, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        var project = EditorProject(media: [video],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 2, backgroundRemoved: true)],
            aspectRatio: .source)
        project.backdropPreset = .navyGlow
        #expect(project.needsStudioCompositor)
        let built = try await CompositionBuilder.build(project: project)
        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.playbackVideoComposition
        let frame = try generator.copyCGImage(at: CMTime(seconds: 1, preferredTimescale: 600), actualTime: nil)
        let middle = try #require(frame.sample(x: frame.width / 2, y: Int(Double(frame.height) * 0.42)))
        #expect(middle.blue > middle.green + 30 && middle.blue > middle.red + 30, "swap: \(middle)")
    }

    /// Exports the QA copy of a real project with backdrops on its cards, for
    /// a look by eye. Set `YAPPER_BACKDROP_QA_PROJECT` to a `.yapperproj` and
    /// `YAPPER_BACKDROP_QA_OUTPUT` to where the .mp4 should go.
    @Test func realProjectExportForReview() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let path = environment["YAPPER_BACKDROP_QA_PROJECT"], let output = environment["YAPPER_BACKDROP_QA_OUTPUT"] else {
            return
        }
        let store = ProjectPackageStore(package: ProjectPackage(url: URL(filePath: path)))
        var project = try #require(try await store.load())
        let looks: [OverlayBackdrop] = [.frosted, .preset(.navyGlow), .preset(.lightRays), .preset(.grainient)]
        var next = 0
        for index in (project.overlays ?? []).indices where !OverlayFrame.isFullFrame(project.overlays![index]) {
            project.overlays![index].backdrop = looks[next % looks.count]
            next += 1
        }
        let url = URL(filePath: output)
        try? FileManager.default.removeItem(at: url)
        try await ExportService.export(project: project, to: url)
        #expect(FileManager.default.fileExists(atPath: output))
    }
}
