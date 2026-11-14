@preconcurrency import AppKit
import SwiftUI

/// One overlay on the player canvas: drawn where it will be exported and moved
/// by dragging it. Its corners and rotate grip are `OverlaySelectionChrome`.
struct OverlayCanvasItem: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let canvasSize: CGSize
    let isSelected: Bool
    let onGuidesChanged: ([CanvasGuide]) -> Void

    /// The drag lives on the session, not here: these views are rebuilt while a
    /// gesture is running, and state kept here went with them.
    @ObservedObject var drag: CanvasDragState

    private var placement: OverlayCanvasPlacement {
        OverlayCanvasPlacement(session: session, overlay: overlay, drag: drag, canvasSize: canvasSize)
    }

    /// What the gesture is doing right now wins over what is saved, so a drag
    /// stays smooth while the project catches up behind it.
    private var displayed: ProjectOverlay { drag.overlayDraft(for: overlay.id) ?? overlay }

    private var media: ProjectMedia? { session.media(for: overlay) }
    private var isImage: Bool { media?.isImage ?? false }
    /// Depth is not a frame property. Read the live saved item so a canvas view
    /// retained across a compositor rebuild cannot keep the pre-toggle value.
    private var isBehindSpeaker: Bool {
        session.project.overlays?.first { $0.id == overlay.id }?.isBehindSpeaker
            ?? overlay.isBehindSpeaker
    }

    /// True when this overlay's picture is drawn here, over the player, rather
    /// than composited into it.
    ///
    /// A still is normally drawn here, because the player's composition does
    /// not carry stills. One that has to sit under the speaker is carried by
    /// the composition instead, and drawing it again here would put it straight
    /// back on top of the speaker it was meant to go behind.
    private var drawsItsOwnPicture: Bool {
        isImage && !session.project.compositedOverlayIDs.contains(overlay.id)
    }

    var body: some View {
        // Sized from the drag, so a resize is live; placed from the saved box,
        // so a move is a transform rather than a layout pass.
        let placement = placement
        let frame = placement.box
        content(box: frame)
            .frame(width: max(1, frame.width), height: max(1, frame.height))
            .contentShape(Rectangle())
            .onTapGesture { session.selectOverlay(overlay.id) }
            .contextMenu {
                PropertiesMenuItems(session: session, item: .overlay(overlay.id))
            }
            .gesture(moveGesture)
            .overlay { cutawayHint }
            // The corners and the rotate grip are not here: they are drawn over
            // the stage by OverlaySelectionChrome, so the clip at the frame's
            // edge cannot cut them off.
            .rotationEffect(.degrees(placement.displayed.resolvedRotation))
            // Placed last: `position` hands back a view the size of the whole
            // canvas, so anything after it would claim the lot.
            .position(x: placement.savedBox.midX, y: placement.savedBox.midY)
            .offset(placement.dragOffset)
    }

    @ViewBuilder
    private func content(box frame: CGRect) -> some View {
        if let media, media.isScene {
            SceneCanvasPreview(media: media, overlay: displayed, size: frame.size, clock: session.playbackClock)
        } else if drawsItsOwnPicture, let image = session.thumbnailsByMedia[overlay.mediaID]?.first {
            let full = OverlayFrame.isFullFrame(displayed)
            CroppedOverlayImage(
                image: session.gradedOverlayImage(image),
                crop: displayed.resolvedCrop,
                mediaAspect: session.media(for: displayed).map(CompositionBuilder.aspect(of:)) ?? 1,
                box: frame
            )
                .clipShape(
                    RoundedRectangle(
                        cornerRadius: full ? 0 : OverlayFrame.cornerRadius(in: canvasSize),
                        style: .continuous
                    )
                )
                .shadow(
                    color: .black.opacity(full ? 0 : 0.28),
                    radius: full ? 0 : 9,
                    y: full ? 0 : 3
                )
        } else {
            // A cutaway, or a composited still, is already playing underneath.
            // Anything drawn here would be a second, staler copy of it.
            Color.clear
        }
    }

    @ViewBuilder
    private var cutawayHint: some View {
        if OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: isBehindSpeaker,
            isImage: isImage,
            isSelected: isSelected
        ) {
            // Only cutaways. A still is a solid picture wherever it is drawn
            // from, so it needs no hint about where it is, and a permanent
            // rectangle over one is a line drawn across whatever is behind it:
            // over the speaker's chin, in the case this was found in.
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(Color.white.opacity(0.22), lineWidth: 1)
                .padding(-2)
        }
    }

    private var moveGesture: some Gesture {
        // Measured against the stage, never against the overlay: the overlay is
        // moving with the drag. See CanvasCoordinateSpace.
        DragGesture(minimumDistance: 1, coordinateSpace: .named(CanvasCoordinateSpace.stage))
            .onChanged { value in
                if drag.overlayOrigin?.id != overlay.id {
                    drag.beginOverlay(overlay)
                    // Only if it is not already the selected one: re-selecting
                    // publishes, and publishing mid-drag rebuilds this view.
                    if !isSelected { session.selectOverlay(overlay.id) }
                }
                guard let origin = drag.overlayOrigin else { return }
                let moved = OverlayCanvasGeometry.moved(
                    overlay: origin,
                    origin: CGPoint(x: origin.x, y: origin.y),
                    translation: value.translation,
                    canvasSize: canvasSize,
                    // Not gated on the timeline's magnetism, which is about
                    // clips landing on cuts in time and has nothing to say
                    // about where a picture sits in the frame. Turning that off
                    // silently took the alignment guides with it, while the
                    // captions kept theirs, so the two behaved differently for
                    // no reason anybody could see. Option still bypasses.
                    snapping: !isSnapBypassed,
                    // The shape of the picture, not of the box it sits in: the
                    // guides have to line up with what you can see.
                    shownAspect: session.aspects(for: origin).media
                )
                drag.updateOverlay(moved.overlay)
                onGuidesChanged(moved.guides)
                // Nothing is written to the project mid-drag. The canvas draws
                // from `interaction`, so saving each step bought no smoothness
                // and cost two republishes of the whole editor per frame, which
                // is exactly what made this jitter.
            }
            .onEnded { _ in
                finish()
            }
    }

    private func finish() {
        OverlayCanvasCommit.finish(session: session, drag: drag)
        onGuidesChanged([])
    }

    /// Holding Option drops an overlay exactly where the pointer is, matching
    /// the bypass the timeline and the captions already use.
    private var isSnapBypassed: Bool {
        NSEvent.modifierFlags.contains(.option)
    }
}

/// Editor-only decoration for an overlay. A behind-speaker overlay is already
/// composited into the player, below the foreground-person pass. Any SwiftUI
/// perimeter added here would be painted after that pass and would therefore
/// cut across the person even though the overlay itself is at the right depth.
enum OverlayCanvasChrome {
    static func showsCutawayHint(
        isBehindSpeaker: Bool,
        isImage: Bool,
        isSelected: Bool
    ) -> Bool {
        !isBehindSpeaker && !isImage && !isSelected
    }
}

/// The kept rectangle of an image, filling its box.
///
/// The whole picture is drawn at the size and offset the crop asks for and the
/// box clips the rest, which is the same arithmetic Core Animation runs with
/// `contentsRect` when the frame is exported.
private struct CroppedOverlayImage: View {
    let image: CGImage
    let crop: OverlayCrop
    let mediaAspect: Double
    let box: CGRect

    var body: some View {
        let placement = crop.mediaPlacement(
            mediaAspect: mediaAspect,
            boxAspect: box.height > 0 ? Double(box.width / box.height) : mediaAspect
        )
        Image(decorative: image, scale: 1)
            .resizable()
            .interpolation(.high)
            .frame(
                width: max(1, box.width * placement.width),
                height: max(1, box.height * placement.height)
            )
            .offset(
                x: box.width * placement.x,
                y: box.height * placement.y
            )
            .frame(width: max(1, box.width), height: max(1, box.height), alignment: .topLeading)
            .clipped()
    }
}
