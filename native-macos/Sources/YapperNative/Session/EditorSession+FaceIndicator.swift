import CoreGraphics
import Foundation

/// Where the face the retouch acts on is, right now, so the canvas can say so.
///
/// The retouch sliders act on "the largest face in shot" and until now that was
/// a sentence rather than something you could see. When a slider does something
/// subtle, a creator has no way to tell a filter that is working gently from
/// one that never found a face at all, and will reasonably assume the second.
/// Every editor that offers this draws the box for exactly that reason.
///
/// Source fractions with the origin at the top left, which is what
/// `FaceDetectionService` hands back and what `VideoFramingGeometry.mediaBox`
/// can be measured against. Deliberately not the rendered frame's fractions:
/// the box has to sit on the picture wherever the framing has pushed it, and
/// the picture is what `mediaBox` describes.
@MainActor
extension EditorSession {
    /// The face on the frame under the playhead, or `nil` when there is none.
    ///
    /// Answers from `FaceDetectionService`'s own cache most of the time, which
    /// is why this can be asked again every time the playhead moves.
    func faceBoxAtPlayhead() async -> CGRect? {
        guard !project.isVideoTrackHidden, !project.clips.isEmpty else { return nil }
        guard
            let hit = project.clip(at: min(currentTime, project.duration)),
            project.clips.indices.contains(hit.index)
        else { return nil }

        let mediaID = project.clips[hit.index].mediaID
        guard let media = project.media.first(where: { $0.id == mediaID }) else { return nil }

        let found = await faceDetectionService.faces(in: media, at: [hit.sourceTime])
        // Asked for one moment, but the service rounds to its own cache step,
        // so take whatever came back rather than the exact key.
        guard let rects = found.values.first else { return nil }
        // The largest, not the union of them: the compositor retouches the
        // largest face in shot, and a bracket drawn around two people would be
        // pointing at something that is not what happens.
        guard let largest = rects.max(by: { $0.width * $0.height < $1.width * $1.height })
        else { return nil }

        // What the detector treats as the face, rather than the box Vision
        // drew. The two differ by a forehead, which is where the spots are, so
        // showing Vision's box would draw the brackets around the half of the
        // face this is not looking at. Vision's box arrives measured from the
        // top left, so the forehead is added upward by taking y back.
        return BlemishDetector.fullFaceFromTopLeft(largest)
    }

    /// Whether the canvas should be drawing that box.
    ///
    /// Only while something is actually reading the face. A permanent bracket
    /// around a speaker is a heads-up display, not an editor, and the one thing
    /// it would reliably do is sit in front of the picture being judged.
    var showsFaceIndicator: Bool {
        !(backgroundClip?.resolvedRetouch ?? .none).isNeutral
    }
}
