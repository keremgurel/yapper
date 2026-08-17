@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// A screenshot laid over a talking head is the case this whole effect exists
/// for, and a screenshot is a still. Stills are normally painted on at the end
/// by Core Animation, which draws over the finished video and so can never put
/// one underneath the speaker. Marking one to sit behind the speaker has to
/// move it into the composition instead.
@Suite(.serialized)
struct StillBehindSpeakerTests {
    private let directory = FileManager.default.temporaryDirectory
        .appending(path: "yapper-still-behind-tests")

    private func built(behindSpeaker: Bool) async throws -> (BuiltComposition, () -> Void) {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let speakerURL = directory.appending(path: "speaker.mov")
        let cardURL = directory.appending(path: "card.png")
        let cleanup: () -> Void = { _ = try? FileManager.default.removeItem(at: self.directory) }

        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )
        try writeSolidPNG(color: .blue, size: CGSize(width: 320, height: 180), to: cardURL)

        let speaker = try await MediaProbe.inspect(url: speakerURL)
        let card = try await MediaProbe.inspect(url: cardURL)
        let project = EditorProject(
            media: [speaker, card],
            clips: [TimelineClip(mediaID: speaker.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [
                ProjectOverlay(
                    mediaID: card.id,
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

    @Test("A still marked to sit behind the speaker is composited, not painted on")
    func theStillMovesIntoTheComposition() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        let layers = try layers(built)
        #expect(layers.count == 3)
        // Front to back: the cut-out speaker, the card, the whole clip.
        #expect(layers[0].matte)
        if case .still = layers[1].source {} else {
            Issue.record("The card should be composited as a still.")
        }
        if case .track = layers[2].source {} else {
            Issue.record("The clip underneath should still be a track.")
        }
        // And it is not also being burned in on top, which would undo all this.
        #expect(built.videoComposition?.animationTool == nil)
    }

    /// A still that is not marked keeps the cheaper route it always had: no
    /// track, no compositor, burned in by Core Animation at the end.
    @Test("An ordinary still is still painted on at the end")
    func anUnmarkedStillIsUnchanged() async throws {
        let (built, cleanup) = try await built(behindSpeaker: false)
        defer { cleanup() }

        #expect(built.videoComposition?.customVideoCompositorClass == nil)
        #expect(built.videoComposition?.animationTool != nil)
        // One instruction naming one track: the clip, and nothing else.
        let instruction = try #require(
            built.videoComposition?.instructions.first as? AVMutableVideoCompositionInstruction
        )
        #expect(instruction.layerInstructions.count == 1)
    }

    /// A composited still is a card like any other, so it keeps its rounding
    /// and its shadow. Losing them on toggle would be a visible change to a
    /// card the creator did not ask to restyle.
    @Test("A composited card keeps its rounding and shadow")
    func theCardKeepsItsLook() async throws {
        let (built, cleanup) = try await built(behindSpeaker: true)
        defer { cleanup() }

        let card = try #require(try layers(built)[1].card)
        #expect(card.cornerRadius > 0)
        #expect(card.shadowOpacity > 0)
    }

    /// The card is in the frame at all, in the right place, and the clip is
    /// still behind it. Vision finds no person in a flat green frame, so the
    /// cut-out draws nothing and what is left is the sandwich without its top.
    @Test("The composited card lands where it was placed")
    func theCardIsDrawnInItsBox() async throws {
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

        let insideTheCard = try #require(frame.sample(x: 320, y: 180))
        // Fully the card, not the card blended with the clip behind it.
        #expect(insideTheCard.blue > 240)
        #expect(insideTheCard.green < 20)
        let outsideIt = try #require(frame.sample(x: 30, y: 330))
        #expect(outsideIt.green > outsideIt.blue + 40)
    }

    /// A graphic on a transparent field is the common shape of an overlay: a
    /// pill, a badge, a card with a glow around it. The card's shadow has to
    /// follow the picture rather than the box it sits in, or every empty corner
    /// of the overlay shades the frame behind it.
    @Test("A still with a transparent margin casts no shadow over the margin")
    func transparencyIsNotShaded() async throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { _ = try? FileManager.default.removeItem(at: directory) }
        let speakerURL = directory.appending(path: "speaker.mov")
        let badgeURL = directory.appending(path: "badge.png")

        try await SyntheticVideo.write(
            color: CGColor(red: 0, green: 0.6, blue: 0, alpha: 1),
            size: CGSize(width: 640, height: 360),
            seconds: 2,
            to: speakerURL
        )
        try writeBadgePNG(to: badgeURL)

        let speaker = try await MediaProbe.inspect(url: speakerURL)
        let badge = try await MediaProbe.inspect(url: badgeURL)
        let project = EditorProject(
            media: [speaker, badge],
            clips: [TimelineClip(mediaID: speaker.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [
                ProjectOverlay(
                    mediaID: badge.id,
                    timelineStart: 0,
                    duration: 2,
                    x: 0.25,
                    y: 0.25,
                    width: 0.5,
                    height: 0.5,
                    behindSpeaker: true
                ),
            ],
            aspectRatio: .source
        )
        let built = try await CompositionBuilder.build(project: project)

        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.videoComposition
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let frame = try generator.copyCGImage(
            at: CMTime(seconds: 1, preferredTimescale: 600),
            actualTime: nil
        )

        // Inside the overlay's box, in the part of the picture that is empty.
        // The clip behind it has to come through at full strength.
        let throughTheGap = try #require(frame.sample(x: 180, y: 110))
        let untouched = try #require(frame.sample(x: 40, y: 330))
        #expect(abs(throughTheGap.green - untouched.green) <= 8)
    }

    /// A small opaque square on a transparent field.
    private func writeBadgePNG(to url: URL) throws {
        let size = CGSize(width: 320, height: 180)
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
        NSColor.clear.setFill()
        NSBezierPath(rect: CGRect(origin: .zero, size: size)).fill()
        NSColor.blue.setFill()
        NSBezierPath(rect: CGRect(x: 130, y: 70, width: 60, height: 40)).fill()
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
