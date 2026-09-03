@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A cutaway marked to sit behind the speaker puts the speaker's clip on screen
/// twice: whole underneath, and cut out again on top of the cutaway. What these
/// check is that the sandwich is built in that order and that nothing about an
/// unmarked cutaway changed.
///
/// What they cannot check is the cut itself. There is no person in a synthetic
/// movie, so Vision finds nobody and the cut-out draws nothing, which is worth
/// a test of its own: that is the failure a real export can hit on a frame the
/// speaker has stepped out of, and it has to leave the cutaway visible rather
/// than cover it with an uncut copy of the clip.
@Suite(.serialized)
struct BehindSpeakerCompositionTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-behind-speaker-tests")

    private func built(
        behindSpeaker: Bool,
        speakerColor: CGColor = CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
        cutawayColor: CGColor = CGColor(red: 0, green: 0, blue: 1, alpha: 1)
    ) async throws -> (BuiltComposition, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cutawayURL = directory.appending(path: "cutaway.mov")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

        try await SyntheticVideo.write(
            color: speakerColor,
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )
        try await SyntheticVideo.write(
            color: cutawayColor,
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
                    behindSpeaker: behindSpeaker ? true : nil
                ),
            ],
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

    @Test("Behind me preserves skin-tone midtones and dark overlays in preview and export")
    func depthDoesNotChangeColor() async throws {
        func samples(behind: Bool, preview: Bool) async throws -> [SampledPixel] {
            let (built, cleanup) = try await built(
                behindSpeaker: behind,
                speakerColor: CGColor(red: 0.62, green: 0.43, blue: 0.34, alpha: 1),
                cutawayColor: CGColor(red: 0.13, green: 0.14, blue: 0.16, alpha: 1)
            )
            defer { cleanup() }
            let generator = AVAssetImageGenerator(asset: built.asset)
            generator.videoComposition = preview ? built.playbackVideoComposition : built.videoComposition
            let frame = try generator.copyCGImage(
                at: CMTime(seconds: 1, preferredTimescale: 600), actualTime: nil
            )
            // Compare displayed colors, not bytes encoded in different spaces.
            let context = try #require(CGContext(
                data: nil, width: frame.width, height: frame.height,
                bitsPerComponent: 8, bytesPerRow: frame.width * 4,
                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ))
            context.draw(frame, in: CGRect(x: 0, y: 0, width: frame.width, height: frame.height))
            let normalized = try #require(context.makeImage())
            return try [#require(normalized.sample(x: 20, y: 20)),
                        #require(normalized.sample(x: 320, y: 180))]
        }
        for preview in [true, false] {
            let normal = try await samples(behind: false, preview: preview)
            let behind = try await samples(behind: true, preview: preview)
            // Vision's accurate model can label a solid skin-colored frame as
            // foreground. Compare the unobscured main image in both modes;
            // the fast model also leaves the dark card visible in this fixture.
            for (expected, actual) in zip(normal.prefix(preview ? 2 : 1), behind) {
                #expect(abs(expected.red - actual.red) <= 3)
                #expect(abs(expected.green - actual.green) <= 3)
                #expect(abs(expected.blue - actual.blue) <= 3)
            }
        }
    }

    @Test("The speaker is drawn again, cut out, in front of the cutaway")
    func theSandwichIsBuiltInOrder() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        let layers = try layers(built)
        #expect(layers.count == 3)
        // Front to back: the cut-out, then the cutaway, then the whole clip.
        #expect(layers[0].matte)
        #expect(layers[1].matte == false)
        #expect(layers[2].matte == false)
        #expect(layers[0].trackID == layers[2].trackID)
        #expect(layers[1].trackID != layers[0].trackID)
    }

    /// Both copies are the same picture in the same place, so a punch-in has to
    /// move them together. They would drift apart if the cut-out were given the
    /// frame's own transform instead of the clip's.
    @Test("Both copies of the speaker are placed identically")
    func theCopiesShareATransform() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        let layers = try layers(built)
        #expect(layers[0].transform == layers[2].transform)
        #expect(layers[0].endTransform == layers[2].endTransform)
    }

    @Test("Cutting the speaker out moves the project onto the editor's compositor")
    func theCustomCompositorIsUsed() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == StudioVideoCompositor.self)
        #expect(
            built.playbackVideoComposition?.customVideoCompositorClass
                == StudioVideoCompositor.self
        )
    }

    /// The preview and the export disagree about this and only this, so they
    /// are handed different instructions when there is a cut to make.
    @Test("The export cuts accurately and the player cuts fast")
    func eachRendererGetsItsOwnQuality() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        let export = built.videoComposition?.instructions.first as? StudioCompositionInstruction
        let preview = built.playbackVideoComposition?.instructions
            .first as? StudioCompositionInstruction
        #expect(export?.matteQuality == .accurate)
        #expect(preview?.matteQuality == .fast)
    }

    /// An ungraded project with nothing cut out has to build exactly the
    /// composition it always did, on AVFoundation's own compositor.
    @Test("An ordinary cutaway is untouched by any of this")
    func anUnmarkedCutawayIsUnchanged() async throws {
        let (built, cleanup) = try await built(behindSpeaker: false)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == nil)
        let instruction = built.videoComposition?.instructions.first
        #expect(instruction is AVMutableVideoCompositionInstruction)
    }

    /// The safe failure. Vision finds nobody in a flat green frame, so the
    /// cut-out contributes nothing and the cutaway stays on screen. Drawing the
    /// clip whole instead would hide the cutaway completely.
    @Test("A frame with nobody in it leaves the cutaway showing")
    func anEmptyMatteDrawsNothing() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
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
        // And the clip underneath is still there, outside the cutaway's box.
        let corner = try #require(frame.sample(x: 20, y: 20))
        #expect(corner.green > corner.blue + 40)
    }
}
