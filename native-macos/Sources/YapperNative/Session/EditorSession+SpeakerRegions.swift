import CoreGraphics
import Foundation

/// Where the speaker is, in the finished frame, at moments on the timeline.
///
/// The rest of the app works in the rendered frame's fractions, so the mapping
/// out of source space happens here and once.
@MainActor
extension EditorSession {
    /// How far apart the samples that describe the whole video are, and how
    /// many of them there may be. Enough for the model to see the speaker move;
    /// few enough that the probe finishes before anyone notices it started.
    private static let speakerTrackStep = 1.5
    private static let speakerTrackLimit = 24

    /// Where the speaker is across the whole video, coarsely.
    ///
    /// This is what the model is shown before it picks its boxes. It cannot be
    /// the exact span an overlay will cover, because which spans exist is
    /// decided by the same reply this feeds.
    func speakerTrack() async -> [SpeakerSample] {
        guard duration > 0 else { return [] }
        let step = max(Self.speakerTrackStep, duration / Double(Self.speakerTrackLimit))
        var times: [Double] = []
        var cursor = min(step / 2, duration / 2)
        while cursor < duration, times.count < Self.speakerTrackLimit {
            times.append(cursor)
            cursor += step
        }
        let rects = await faceRects(atTimelineTimes: times)
        return times.compactMap { time in
            rects[time].map { SpeakerSample(at: time, rect: $0) }
        }
    }

    /// What an overlay covering this stretch of the timeline has to stay off.
    ///
    /// Sampled across the span rather than at its start: the box is fixed for
    /// the overlay's whole life, so it has to clear everywhere the speaker was
    /// while it was on screen.
    func speakerRegions(from start: Double, to end: Double) async -> [SpeakerRegion] {
        let span = max(0, end - start)
        let count = span < 2 ? 3 : 5
        let times = (0 ..< count).map { index in
            start + span * (Double(index) + 0.5) / Double(count)
        }
        let rects = await faceRects(atTimelineTimes: times)
        return SpeakerRegions.avoid(faces: Array(rects.values))
    }

    /// One face box per timeline moment, in the rendered frame's own fractions.
    ///
    /// Moments where nothing was found are absent rather than empty, so a
    /// caller can tell "the speaker is here" from "we could not see".
    private func faceRects(atTimelineTimes times: [Double]) async -> [Double: CGRect] {
        guard !project.isVideoTrackHidden, !project.clips.isEmpty else { return [:] }

        // One request per source video, so a video that several of these
        // moments land in is opened once.
        var wanted: [UUID: [Double]] = [:]
        var source: [Double: (media: UUID, time: Double)] = [:]
        for time in times {
            guard let hit = project.clip(at: time), project.clips.indices.contains(hit.index) else {
                continue
            }
            let mediaID = project.clips[hit.index].mediaID
            wanted[mediaID, default: []].append(hit.sourceTime)
            source[time] = (mediaID, hit.sourceTime)
        }

        let frameAspect = project.resolvedAspectRatio
        var byMedia: [UUID: [Double: CGRect]] = [:]
        for (mediaID, sourceTimes) in wanted {
            guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
            let found = await faceDetectionService.faces(in: media, at: sourceTimes)
            let sourceAspect = CompositionBuilder.aspect(of: media)
            byMedia[mediaID] = found.compactMapValues { rects in
                SpeakerRegions.union(rects).map {
                    SpeakerRegions.inFrame($0, sourceAspect: sourceAspect, frameAspect: frameAspect)
                }
            }
        }

        return times.reduce(into: [:]) { result, time in
            guard
                let origin = source[time],
                let rect = byMedia[origin.media]?[origin.time]
            else { return }
            result[time] = rect
        }
    }
}
