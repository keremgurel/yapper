@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A cropped cutaway has to show the part of the picture that was kept, in the
/// box it was already in, and nothing else. The cutaway here is red on its left
/// half and blue on its right, so the colour on screen says which half survived.
@Suite(.serialized)
struct CroppedOverlayCompositionTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-cropped-overlay-tests")

    private func built(crop: OverlayCrop?) async throws -> (BuiltComposition, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cutawayURL = directory.appending(path: "split.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )
        try await SyntheticVideo.writeSplit(
            left: CGColor(red: 1, green: 0, blue: 0, alpha: 1),
            right: CGColor(red: 0, green: 0, blue: 1, alpha: 1),
            size: CGSize(width: 320, height: 180),
            seconds: 2,
            to: cutawayURL
        )

        let speaker = try await MediaProbe.inspect(url: speakerURL)
        let cutaway = try await MediaProbe.inspect(url: cutawayURL)
        let project = EditorProject(
            media: [speaker, cutaway],
            clips: [TimelineClip(mediaID: speaker.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [
                ProjectOverlay(
                    mediaID: cutaway.id,
                    timelineStart: 0,
                    duration: 2,
                    x: 0.25,
                    y: 0.25,
                    width: 0.5,
                    height: 0.5,
                    crop: crop
                ),
            ],
            aspectRatio: .source
        )
        return (try await CompositionBuilder.build(project: project), cleanup)
    }

    private func frame(_ built: BuiltComposition) throws -> CGImage {
        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.playbackVideoComposition
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        return try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )
    }

    @Test func anUncroppedCutawayShowsBothHalves() async throws {
        let (built, cleanup) = try await built(crop: nil)
        defer { cleanup() }
        let image = try frame(built)
        // The box spans the middle half of a 640-wide frame: 160 to 480.
        #expect(image.sample(x: 220, y: 180)?.isMostlyRed == true)
        #expect(image.sample(x: 420, y: 180)?.isMostlyBlue == true)
    }

    @Test func croppingToTheRightHalfShowsOnlyBlue() async throws {
        let (built, cleanup) = try await built(
            crop: OverlayCrop(x: 0.5, y: 0, width: 0.5, height: 1)
        )
        defer { cleanup() }
        let image = try frame(built)
        // Every part of the box is now the kept half.
        #expect(image.sample(x: 260, y: 180)?.isMostlyBlue == true)
        #expect(image.sample(x: 380, y: 180)?.isMostlyBlue == true)
        #expect(image.sample(x: 260, y: 180)?.isMostlyRed == false)
    }

    @Test func aCroppedCutawayStaysInsideItsBox() async throws {
        let (built, cleanup) = try await built(
            crop: OverlayCrop(x: 0.5, y: 0, width: 0.5, height: 1)
        )
        defer { cleanup() }
        let image = try frame(built)
        // Outside the box the speaker is still the only thing on screen.
        let outside = image.sample(x: 40, y: 40)
        #expect(outside?.isMostlyBlue == false)
        #expect(outside?.isMostlyRed == false)
        #expect((outside?.green ?? 0) > 80)
    }

    @Test func aHiddenOverlayDrawsNothing() async throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let speakerURL = directory.appending(path: "speaker-hidden.mov")
        let cutawayURL = directory.appending(path: "split-hidden.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )
        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0, blue: 1, alpha: 1),
            size: CGSize(width: 320, height: 180),
            seconds: 2,
            to: cutawayURL
        )
        let speaker = try await MediaProbe.inspect(url: speakerURL)
        let cutaway = try await MediaProbe.inspect(url: cutawayURL)
        let project = EditorProject(
            media: [speaker, cutaway],
            clips: [TimelineClip(mediaID: speaker.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [
                ProjectOverlay(
                    mediaID: cutaway.id,
                    timelineStart: 0,
                    duration: 2,
                    x: 0.25,
                    y: 0.25,
                    width: 0.5,
                    height: 0.5,
                    isHidden: true
                ),
            ],
            aspectRatio: .source
        )
        let built = try await CompositionBuilder.build(project: project)
        let image = try frame(built)
        #expect(image.sample(x: 320, y: 180)?.isMostlyBlue == false)
    }
}
