@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

private let djiReferenceURL = URL(
    filePath: "/Volumes/G Micro Pro/DCIM/DJI_001/DJI_20260719173505_0045_D.MP4"
)

/// The move has to reach the composition, not just the model.
///
/// Everything else about keyframes is arithmetic that can be checked on its
/// own; this is the seam where it turns into something AVFoundation renders,
/// and a punch-in that interpolates perfectly in Swift and exports as a jump
/// would look exactly like a punch-in right up until the export.
@Suite(.serialized)
struct FramingKeyCompositionTests {
    private func project(filtered: Bool = false) async throws -> EditorProject {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        var clip = TimelineClip(mediaID: media.id, sourceStart: 20, sourceEnd: 24)
        clip.framingKeys = [
            FramingKey(at: 20, framing: VideoFraming(scale: 1, x: 0, y: 0)),
            FramingKey(at: 23, framing: VideoFraming(scale: 2, x: 0, y: 0)),
        ]
        return EditorProject(
            name: "Punch-in",
            media: [media],
            clips: [clip],
            visualFilter: filtered ? VisualFilter(id: .warm, strength: 0.8) : nil
        )
    }

    /// The main track's layer instruction has to carry a ramp, which is the one
    /// thing AVFoundation's own compositor can be told to animate.
    @Test(
        "A keyed clip exports as a ramp rather than a jump",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func keyedClipRamps() async throws {
        let built = try await CompositionBuilder.build(project: try await project(), for: .export)
        let instructions = try #require(built.videoComposition?.instructions)

        var ramps: [(start: CGAffineTransform, end: CGAffineTransform)] = []
        for instruction in instructions {
            guard
                let instruction = instruction as? AVVideoCompositionInstruction,
                let layer = instruction.layerInstructions.first
            else { continue }
            var start = CGAffineTransform.identity
            var end = CGAffineTransform.identity
            var range = CMTimeRange.zero
            guard
                layer.getTransformRamp(
                    for: instruction.timeRange.start,
                    start: &start,
                    end: &end,
                    timeRange: &range
                )
            else { continue }
            if start != end { ramps.append((start, end)) }
        }

        #expect(!ramps.isEmpty, "the punch-in should have produced at least one ramp")
        // Scale lives in the matrix's diagonal, and a push-in only grows.
        #expect(ramps.allSatisfy { $0.end.a > $0.start.a })
    }

    /// The whole move, end to end: the first frame is fitted and the last is
    /// twice that, whatever the instructions were split into on the way.
    @Test(
        "The move runs from where it started to where it ends",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func theMoveSpansItsKeys() async throws {
        let project = try await project()
        let built = try await CompositionBuilder.build(project: project, for: .export)
        let instructions = try #require(built.videoComposition?.instructions)

        func scale(at time: CMTime) -> CGFloat? {
            for instruction in instructions {
                guard
                    let instruction = instruction as? AVVideoCompositionInstruction,
                    instruction.timeRange.containsTime(time),
                    let layer = instruction.layerInstructions.first
                else { continue }
                var start = CGAffineTransform.identity
                var end = CGAffineTransform.identity
                var range = CMTimeRange.zero
                guard
                    layer.getTransformRamp(
                        for: time,
                        start: &start,
                        end: &end,
                        timeRange: &range
                    )
                else { continue }
                let span = range.duration.seconds
                guard span > 0 else { return start.a }
                let progress = (time - range.start).seconds / span
                return start.a + (end.a - start.a) * CGFloat(progress)
            }
            return nil
        }

        let first = try #require(scale(at: .zero))
        // Three seconds in is the second key: the end of the push.
        let last = try #require(scale(at: CMTime(seconds: 2.95, preferredTimescale: 600)))
        #expect(last > first * 1.9)
    }

    /// A graded project goes through the editor's own compositor, which cannot
    /// use AVFoundation's ramps and has to interpolate by hand. If the two ever
    /// disagree, turning on a filter would quietly flatten every punch-in.
    @Test(
        "A graded punch-in moves too",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func gradedKeyedClipTweens() async throws {
        let built = try await CompositionBuilder.build(
            project: try await project(filtered: true),
            for: .export
        )
        let instructions = try #require(built.videoComposition?.instructions)
        let studio = instructions.compactMap { $0 as? StudioCompositionInstruction }

        #expect(!studio.isEmpty, "a filtered project should use the editor's own compositor")
        let moving = studio.filter { instruction in
            instruction.layers.contains { $0.endTransform != nil }
        }
        #expect(!moving.isEmpty, "the punch-in should have reached the compositor")
        #expect(moving.allSatisfy { $0.containsTweening })

        // And the hand-rolled interpolation is the same straight line the ramp
        // would have drawn.
        let layer = try #require(moving.first?.layers.first { $0.endTransform != nil })
        let halfway = layer.transform(at: 0.5)
        let end = try #require(layer.endTransform)
        #expect(abs(halfway.a - (layer.transform.a + end.a) / 2) < 1e-9)
    }

    /// An unkeyed clip must build exactly the composition it always did: one
    /// transform, no ramp, nothing to interpolate.
    @Test(
        "A clip that does not move is built the way it always was",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func stillClipsAreUnchanged() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        var clip = TimelineClip(mediaID: media.id, sourceStart: 20, sourceEnd: 24)
        clip.framing = VideoFraming(scale: 1.4, x: 0.1, y: 0)
        let built = try await CompositionBuilder.build(
            project: EditorProject(media: [media], clips: [clip]),
            for: .export
        )
        let instructions = try #require(built.videoComposition?.instructions)
        let instruction = try #require(instructions.first as? AVVideoCompositionInstruction)
        let layer = try #require(instruction.layerInstructions.first)

        var start = CGAffineTransform.identity
        var end = CGAffineTransform.identity
        var range = CMTimeRange.zero
        _ = layer.getTransformRamp(
            for: instruction.timeRange.start,
            start: &start,
            end: &end,
            timeRange: &range
        )
        #expect(start == end)
    }
}
