@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A video overlay has to come out where the canvas drew it, in the player and
/// in the export. These build a real composition from two solid-colour movies
/// and look at the pixels.
@Suite(.serialized)
struct VideoOverlayCompositionTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-overlay-composition-tests")

    private func makeProject(
        overlayBox: (x: Double, y: Double, width: Double, height: Double)
    ) async throws -> (project: EditorProject, cleanup: () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cutawayURL = directory.appending(path: "cutaway.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

        try await SyntheticVideo.write(
            color: CGColor(red: 1, green: 0, blue: 0, alpha: 1),
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
            name: "Cutaway check",
            media: [speaker, cutaway],
            clips: [TimelineClip(mediaID: speaker.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [
                ProjectOverlay(
                    mediaID: cutaway.id,
                    timelineStart: 0.5,
                    duration: 1,
                    x: overlayBox.x,
                    y: overlayBox.y,
                    width: overlayBox.width,
                    height: overlayBox.height
                ),
            ],
            aspectRatio: .source
        )
        return (project, cleanup)
    }

    private func frame(
        of built: BuiltComposition,
        at seconds: Double
    ) throws -> CGImage {
        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.playbackVideoComposition
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        return try generator.copyCGImage(
            at: CMTime(seconds: seconds, preferredTimescale: 600),
            actualTime: nil
        )
    }

    @Test func aCutawayLandsInTheCornerItWasPlacedIn() async throws {
        let (project, cleanup) = try await makeProject(
            overlayBox: (x: 0.5, y: 0, width: 0.5, height: 0.5)
        )
        defer { cleanup() }

        let built = try await CompositionBuilder.build(project: project)
        #expect(try await built.asset.loadTracks(withMediaType: .video).count == 2)

        let covered = try frame(of: built, at: 1)
        // Top right quarter: the cutaway. Bottom left: the speaker.
        #expect(covered.sample(x: 480, y: 90)?.isMostlyBlue == true)
        #expect(covered.sample(x: 160, y: 270)?.isMostlyRed == true)
        // And the top left, which the cutaway does not reach, stays the speaker.
        #expect(covered.sample(x: 100, y: 90)?.isMostlyRed == true)
    }

    @Test func theCutawayIsOnlyThereWhileItIsOnTheTimeline() async throws {
        let (project, cleanup) = try await makeProject(
            overlayBox: (x: 0.5, y: 0, width: 0.5, height: 0.5)
        )
        defer { cleanup() }

        let built = try await CompositionBuilder.build(project: project)
        let before = try frame(of: built, at: 0.2)
        let after = try frame(of: built, at: 1.8)
        #expect(before.sample(x: 480, y: 90)?.isMostlyRed == true)
        #expect(after.sample(x: 480, y: 90)?.isMostlyRed == true)
    }

    @Test func aFullFrameCutawayCoversTheSpeaker() async throws {
        let (project, cleanup) = try await makeProject(
            overlayBox: (x: 0, y: 0, width: 1, height: 1)
        )
        defer { cleanup() }

        let built = try await CompositionBuilder.build(project: project)
        let covered = try frame(of: built, at: 1)
        #expect(covered.sample(x: 320, y: 180)?.isMostlyBlue == true)
        #expect(covered.sample(x: 40, y: 40)?.isMostlyBlue == true)
    }
}
