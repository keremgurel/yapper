@preconcurrency import AppKit
import SwiftUI

/// The two gestures that frame the main track: the picture you push, and the
/// corners you pull.
///
/// They are one behaviour wearing two hats, and the hats live in different
/// views. The pan is inside the stage and under the overlays, so a click meant
/// for a caption still reaches the caption. The corners are outside the stage
/// and unclipped, so a picture zoomed past the frame still has handles you can
/// get at. Both measure against the stage, both begin from the framing the
/// gesture started on, and both commit the same way, so that part sits here
/// rather than being written twice.
@MainActor
struct VideoFramingGesture {
    let session: EditorSession
    let drag: CanvasDragState
    let stageSize: CGSize
    /// Only the pan snaps, so only the pan has anything to say about guides.
    var onGuidesChanged: ([CanvasGuide]) -> Void = { _ in }

    var pan: some Gesture {
        // Against the stage, which stands still, rather than against the
        // picture, which is what the drag is moving. See CanvasCoordinateSpace.
        DragGesture(minimumDistance: 1, coordinateSpace: .named(CanvasCoordinateSpace.stage))
            .onChanged { value in
                guard let origin = beginIfNeeded(from: value.startLocation) else { return }
                let panned = VideoFramingGeometry.panned(
                    framing: origin,
                    translation: value.translation,
                    canvasSize: stageSize,
                    // The shape of the footage, which is where the picture's own
                    // edges are. Without it the edges cannot be settled onto the
                    // frame's, only the middles.
                    sourceAspect: session.framingSourceAspect,
                    // Always, like the captions and the overlays: aligning a
                    // picture in the frame is not what the timeline's magnetism
                    // is about. Option bypasses.
                    snapping: !isSnapBypassed
                )
                drag.updateFraming(panned.framing)
                if let clipID = drag.framingClipID {
                    session.previewFraming(panned.framing, clipID: clipID)
                }
                onGuidesChanged(panned.guides)
            }
            .onEnded { _ in finish() }
    }

    func zoom(_ corner: CanvasResizeCorner) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
            .onChanged { value in
                guard let origin = beginIfNeeded(from: value.startLocation) else { return }
                let zoomed = VideoFramingGeometry.zoomed(
                    framing: origin,
                    translation: value.translation,
                    corner: corner,
                    canvasSize: stageSize
                )
                drag.updateFraming(zoomed)
                if let clipID = drag.framingClipID {
                    session.previewFraming(zoomed, clipID: clipID)
                }
            }
            .onEnded { _ in finish() }
    }

    /// Turning the picture, swept about the middle of it.
    ///
    /// Measured as an angle rather than as a distance, so the picture turns as
    /// far as the pointer went round however far out it wandered, which is how
    /// every other editor's rotate handle behaves.
    func turn(centre: CGPoint, from start: CGPoint, to current: CGPoint, ended: Bool) {
        guard let origin = beginIfNeeded(from: start) else { return }
        let turned = VideoFramingGeometry.rotated(
            framing: origin,
            centre: centre,
            from: start,
            to: current,
            // Straight up and the three quarter turns are what anyone is aiming
            // for. Option is how you say otherwise.
            snapping: !isSnapBypassed
        )
        drag.updateFraming(turned)
        if let clipID = drag.framingClipID {
            session.previewFraming(turned, clipID: clipID)
        }
        if ended { finish() }
    }

    /// The framing this step is measured from, starting or re-basing the drag
    /// as required. Every step measures from one fixed framing, so the steps
    /// never compound into a run away.
    ///
    /// Re-basing is what keeps a resize in one piece. A corner handle moves as
    /// the picture grows, which walks it out from under a pointer that is
    /// travelling more slowly, and SwiftUI answers by cancelling the drag and
    /// offering a fresh one. A fresh drag reports a translation of zero, so
    /// measuring it from the framing the *first* drag started on threw the
    /// picture back to its original size, whereupon it grew again, and again:
    /// the popping that made resizing unusable. A new pressing-down point means
    /// a new gesture, so the picture keeps what it has and the new drag is
    /// measured from there.
    private func beginIfNeeded(from start: CGPoint) -> VideoFraming? {
        guard let clip = session.framingClip else { return drag.framingOrigin }
        if drag.framingClipID != clip.id {
            drag.beginFraming(clip.resolvedFraming, clipID: clip.id, from: start)
        } else if drag.framingStart != start {
            drag.beginFraming(drag.framing ?? clip.resolvedFraming, clipID: clip.id, from: start)
        }
        return drag.framingOrigin
    }

    private func finish() {
        if let finished = drag.endFraming() {
            session.commitFraming(finished.framing, clipID: finished.clipID)
        }
        onGuidesChanged([])
    }

    /// Holding Option puts the picture exactly where the pointer does, matching
    /// the bypass the overlays and the captions already use.
    private var isSnapBypassed: Bool {
        NSEvent.modifierFlags.contains(.option)
    }
}
