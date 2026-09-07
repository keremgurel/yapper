@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// Retouching has to reach the compositor to happen at all, and has to stay
/// away from a clip that did not ask for it.
@Suite(.serialized)
struct RetouchCompositionTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-retouch-composition-tests")

    private func built(
        retouch: ClipRetouch?,
        behindSpeaker: Bool = false
    ) async throws -> (BuiltComposition, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cutawayURL = directory.appending(path: "cutaway.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

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
            clips: [
                TimelineClip(
                    mediaID: speaker.id,
                    sourceStart: 0,
                    sourceEnd: 2,
                    retouch: retouch
                ),
            ],
            overlays: behindSpeaker
                ? [
                    ProjectOverlay(
                        mediaID: cutaway.id,
                        timelineStart: 0,
                        duration: 2,
                        behindSpeaker: true
                    ),
                ]
                : [],
            aspectRatio: .source
        )
        return (try await CompositionBuilder.build(project: project), cleanup)
    }

    private func layers(
        _ built: BuiltComposition
    ) throws -> [StudioCompositionInstruction.Layer] {
        let instruction = try #require(
            built.videoComposition?.instructions.first as? StudioCompositionInstruction
        )
        return instruction.layers
    }

    @Test("A retouched clip is composited by the editor and carries its settings")
    func retouchReachesTheCompositor() async throws {
        let (built, cleanup) = try await built(
            retouch: ClipRetouch(whitenTeeth: 0.25)
        )
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == StudioVideoCompositor.self)
        let layer = try #require(try layers(built).first)
        #expect(layer.retouch.whitenTeeth == 0.25)
    }

    @Test("A clip with the slider at nothing keeps the cheap path")
    func neutralRetouchChangesNothing() async throws {
        let (built, cleanup) = try await built(retouch: ClipRetouch.none)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == nil)
    }

    /// The cut-out is the copy anyone sees, so it has to be retouched to match
    /// the copy underneath. Retouching only the hidden one would make the
    /// sliders look broken on exactly the projects that use both features.
    @Test("Both copies of a cut-out speaker are retouched alike")
    func bothCopiesAreRetouched() async throws {
        let (built, cleanup) = try await built(
            retouch: ClipRetouch(whitenTeeth: 0.8),
            behindSpeaker: true
        )
        defer { cleanup() }

        let layers = try layers(built)
        #expect(layers.count == 3)
        #expect(layers[0].matte)
        #expect(layers[0].retouch == layers[2].retouch)
        #expect(layers[0].retouch.whitenTeeth == 0.8)
        // And the cutaway between them is not being retouched.
        #expect(layers[1].retouch.isNeutral)
    }

    /// A retouched frame is a different picture every frame even when nothing
    /// in the edit moves, so AVFoundation must not be told it can render one
    /// frame and reuse it for the whole stretch.
    @Test("A retouched stretch is never treated as a still")
    func retouchIsAlwaysAnimated() async throws {
        let (built, cleanup) = try await built(retouch: ClipRetouch(whitenTeeth: 1))
        defer { cleanup() }

        let instruction = try #require(
            built.videoComposition?.instructions.first as? StudioCompositionInstruction
        )
        #expect(instruction.containsTweening)
    }

    /// No face in a flat green frame, so nothing is retouched and the frame
    /// comes through as it went in. The failure has to be quiet: an export
    /// cannot stop because someone stepped out of shot.
    @Test("A frame with no face in it comes through untouched")
    func noFaceIsNotAFailure() async throws {
        let (built, cleanup) = try await built(
            retouch: ClipRetouch(whitenTeeth: 1)
        )
        defer { cleanup() }

        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.videoComposition
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let frame = try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )

        let pixel = try #require(frame.sample(x: 320, y: 180))
        #expect(pixel.green > pixel.red + 40)
        #expect(pixel.green > pixel.blue + 40)
    }
}
