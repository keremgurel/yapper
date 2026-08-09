@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct VisualFilterMathTests {
    @Test func noFilterLeavesEveryColourAlone() {
        #expect(VisualFilter.none.colorMatrix.isIdentity)
        #expect(VisualFilter(id: .punch, strength: 0).colorMatrix.isIdentity)
    }

    @Test func monoDrainsTheColourOutOfAFrame() {
        let graded = VisualFilter(id: .mono, strength: 1).colorMatrix
            .apply(red: 1, green: 0, blue: 0)
        // Red, green and blue all land on the same value: it is grey now.
        #expect(abs(graded.red - graded.green) < 0.02)
        #expect(abs(graded.green - graded.blue) < 0.02)
    }

    @Test func halfStrengthMonoKeepsHalfTheColour() {
        let half = VisualFilter(id: .mono, strength: 0.5).colorMatrix
            .apply(red: 1, green: 0, blue: 0)
        #expect(half.red > half.blue + 0.2)
    }

    @Test func punchPushesContrastAndSaturationUp() {
        let plain = (red: 0.6, green: 0.3, blue: 0.3)
        let graded = VisualFilter(id: .punch, strength: 1).colorMatrix
            .apply(red: plain.red, green: plain.green, blue: plain.blue)
        // The bright channel gets brighter and the dark ones get darker.
        #expect(graded.red > plain.red)
        #expect(graded.green < plain.green)
    }

    @Test func warmWashesAGreyAndCoolLeavesItAlone() {
        // Warm is the only one of the two carrying sepia, and sepia is the only
        // thing in either that can tint something with no hue of its own: a hue
        // rotation leaves grey exactly where it found it.
        let warm = VisualFilter(id: .warm, strength: 1).colorMatrix
            .apply(red: 0.5, green: 0.5, blue: 0.5)
        #expect(warm.red > warm.blue)

        let cool = VisualFilter(id: .cool, strength: 1).colorMatrix
            .apply(red: 0.5, green: 0.5, blue: 0.5)
        #expect(abs(cool.red - cool.blue) < 0.001)
    }

    @Test func theTwoTemperaturesTurnAColourDifferentWays() {
        let skin = (red: 0.72, green: 0.52, blue: 0.44)
        let warm = VisualFilter(id: .warm, strength: 1).colorMatrix
            .apply(red: skin.red, green: skin.green, blue: skin.blue)
        let cool = VisualFilter(id: .cool, strength: 1).colorMatrix
            .apply(red: skin.red, green: skin.green, blue: skin.blue)
        // They rotate the hue opposite ways, so the same pixel comes out of
        // each somewhere different. The difference is small by design: these
        // are grades, not effects.
        #expect(abs(warm.green - cool.green) > 0.005)
        #expect(abs(warm.blue - cool.blue) > 0.005)
    }

    @Test func filtersComposeInTheOrderTheBrowserAppliesThem() {
        // Brightness then contrast is not the same as contrast then brightness,
        // so the composition order is part of the look.
        let brightnessFirst = ColorMatrix.contrast(1.5).after(.brightness(1.2))
        let contrastFirst = ColorMatrix.brightness(1.2).after(.contrast(1.5))
        #expect(brightnessFirst != contrastFirst)
        // A grey pixel through brightness 1.2 then contrast 1.5.
        let value = brightnessFirst.apply(red: 0.5, green: 0.5, blue: 0.5)
        #expect(abs(value.red - (0.5 * 1.2 * 1.5 + (0.5 - 0.75))) < 0.0001)
    }
}

/// The grade has to reach the frames themselves, not just the maths.
@Suite(.serialized)
struct VisualFilterCompositionTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-filter-tests")

    private func frame(filter: VisualFilter) async throws -> (CGImage, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let videoURL = directory.appending(path: "red.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }
        try await SyntheticVideo.write(
            color: CGColor(red: 0.9, green: 0.1, blue: 0.1, alpha: 1),
            size: CGSize(width: 320, height: 180),
            seconds: 1,
            to: videoURL
        )
        let media = try await MediaProbe.inspect(url: videoURL)
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)],
            aspectRatio: .source,
            visualFilter: filter
        )
        let built = try await CompositionBuilder.build(project: project)
        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.playbackVideoComposition
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let image = try generator.copyCGImage(
            at: CMTime(seconds: 0.5, preferredTimescale: 600),
            actualTime: nil
        )
        return (image, cleanup)
    }

    @Test func anUngradedProjectStaysOnTheStockCompositor() async throws {
        let (image, cleanup) = try await frame(filter: .none)
        defer { cleanup() }
        #expect(image.sample(x: 160, y: 90)?.isMostlyRed == true)
    }

    @Test func monoReachesTheFramesThemselves() async throws {
        let (image, cleanup) = try await frame(filter: VisualFilter(id: .mono, strength: 1))
        defer { cleanup() }
        let pixel = image.sample(x: 160, y: 90)
        #expect(pixel != nil)
        // Grey: no channel stands out any more.
        #expect(abs((pixel?.red ?? 0) - (pixel?.blue ?? 0)) < 30)
        #expect(pixel?.isMostlyRed == false)
    }

    @Test func aGradedProjectUsesTheEditorsOwnCompositor() async throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let videoURL = directory.appending(path: "plain.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 1),
            size: CGSize(width: 320, height: 180),
            seconds: 1,
            to: videoURL
        )
        let media = try await MediaProbe.inspect(url: videoURL)
        var project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)],
            aspectRatio: .source
        )
        let plain = try await CompositionBuilder.build(project: project)
        #expect(plain.videoComposition?.customVideoCompositorClass == nil)

        project.visualFilter = VisualFilter(id: .warm, strength: 0.8)
        let graded = try await CompositionBuilder.build(project: project)
        #expect(graded.videoComposition?.customVideoCompositorClass != nil)
        #expect(graded.playbackVideoComposition?.customVideoCompositorClass != nil)
    }
}
