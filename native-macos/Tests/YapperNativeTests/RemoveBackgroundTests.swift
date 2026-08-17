@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// Removing a clip's background is the same cut as putting an overlay behind
/// the speaker, arranged differently: one copy of the clip rather than two, and
/// the project's backdrop showing through what was taken away.
@Suite(.serialized)
struct RemoveBackgroundTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-remove-background-tests")

    private func built(
        removed: Bool,
        backdrop: StudioColor? = nil
    ) async throws -> (BuiltComposition, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )

        let speaker = try await MediaProbe.inspect(url: speakerURL)
        let project = EditorProject(
            media: [speaker],
            clips: [
                TimelineClip(
                    mediaID: speaker.id,
                    sourceStart: 0,
                    sourceEnd: 2,
                    backgroundRemoved: removed ? true : nil
                ),
            ],
            aspectRatio: .source,
            backdrop: backdrop
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

    @Test("The clip is drawn once, cut out, with nothing duplicated")
    func theClipIsMattedInPlace() async throws {
        let (built, cleanup) = try await built(removed: true)
        defer { cleanup() }

        let layers = try layers(built)
        #expect(layers.count == 1)
        #expect(layers[0].matte)
    }

    @Test("Removing a background moves the project onto the editor's compositor")
    func theCustomCompositorIsUsed() async throws {
        let (built, cleanup) = try await built(removed: true)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == StudioVideoCompositor.self)
        #expect(
            built.playbackVideoComposition?.customVideoCompositorClass
                == StudioVideoCompositor.self
        )
    }

    /// The preview cuts fast and the export cuts accurately, the same split a
    /// cutaway behind the speaker gets.
    @Test("Each renderer gets the cut quality it can afford")
    func eachRendererGetsItsOwnQuality() async throws {
        let (built, cleanup) = try await built(removed: true)
        defer { cleanup() }

        let export = built.videoComposition?.instructions.first as? StudioCompositionInstruction
        let preview = built.playbackVideoComposition?.instructions
            .first as? StudioCompositionInstruction
        #expect(export?.matteQuality == .accurate)
        #expect(preview?.matteQuality == .fast)
    }

    @Test("A clip that keeps its background is untouched by any of this")
    func anOrdinaryClipIsUnchanged() async throws {
        let (built, cleanup) = try await built(removed: false)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == nil)
        #expect(built.videoComposition?.instructions.first is AVMutableVideoCompositionInstruction)
    }

    /// A backdrop on its own is enough to need the editor's compositor:
    /// AVFoundation fills the frame with black and offers no say in it.
    @Test("A backdrop alone moves the project onto the editor's compositor")
    func aBackdropAloneIsEnough() async throws {
        let (built, cleanup) = try await built(
            removed: false,
            backdrop: StudioColor(hex: "#3B9DFF")
        )
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == StudioVideoCompositor.self)
    }

    /// Black is what the frame was filled with before there was a choice, so
    /// choosing it has to leave the cheap path alone.
    @Test("A black backdrop is not a backdrop at all")
    func blackChangesNothing() async throws {
        let (built, cleanup) = try await built(removed: false, backdrop: .black)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == nil)
    }

    /// Vision finds nobody in a flat green frame, so everything is cut away and
    /// what is left is the backdrop. That is the right answer rather than a
    /// failure: with no speaker in the shot, there is no speaker to keep.
    @Test("What the cut takes away shows the backdrop")
    func theBackdropShowsThrough() async throws {
        let (built, cleanup) = try await built(
            removed: true,
            backdrop: StudioColor(hex: "#0000FF")
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

        let middle = try #require(frame.sample(x: 320, y: 180))
        #expect(middle.isMostlyBlue)
    }
}
