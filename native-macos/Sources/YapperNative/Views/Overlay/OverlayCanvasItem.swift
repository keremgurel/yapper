@preconcurrency import AppKit
import SwiftUI

/// One overlay on the player canvas: drawn where it will be exported, moved by
/// dragging it, resized by its corners.
struct OverlayCanvasItem: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let canvasSize: CGSize
    let isSelected: Bool
    let onGuidesChanged: ([CanvasGuide]) -> Void

    /// The drag lives on the session, not here: these views are rebuilt while a
    /// gesture is running, and state kept here went with them.
    @ObservedObject var drag: CanvasDragState

    /// What the gesture is doing right now wins over what is saved, so a drag
    /// stays smooth while the project catches up behind it.
    private var displayed: ProjectOverlay { drag.overlayDraft(for: overlay.id) ?? overlay }

    private var media: ProjectMedia? { session.media(for: overlay) }
    private var isImage: Bool { media?.isImage ?? false }

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

    private var box: CGRect {
        OverlayFrame.fitted(
            OverlayFrame.box(displayed, in: canvasSize),
            mediaAspect: session.aspects(for: displayed).media
        )
    }

    /// The saved box places the overlay; the drag is carried as a transform on
    /// top. See CaptionCanvasOverlay for why.
    private var dragOffset: CGSize {
        guard drag.overlayDraft(for: overlay.id) != nil else { return .zero }
        let saved = savedBox
        return CGSize(width: box.midX - saved.midX, height: box.midY - saved.midY)
    }

    /// The saved box, which is where the item is placed from.
    private var savedBox: CGRect {
        OverlayFrame.fitted(
            OverlayFrame.box(overlay, in: canvasSize),
            mediaAspect: session.aspects(for: overlay).media
        )
    }

    var body: some View {
        // Sized from the drag, so a resize is live; placed from the saved box,
        // so a move is a transform rather than a layout pass.
        let frame = box
        content
            .frame(width: max(1, frame.width), height: max(1, frame.height))
            // The body takes its own clicks and drags before any decoration
            // goes on top. A hit shape applied after the corner handles cut
            // them off: they hang outside the box on purpose, so the shape
            // clipped exactly the part you reach for, and resizing stopped
            // working on every item at once.
            .contentShape(Rectangle())
            .onTapGesture { session.selectOverlay(overlay.id) }
            .gesture(moveGesture)
            .overlay { selectionBorder }
            .overlay(alignment: .topLeading) { handle(.topLeading) }
            .overlay(alignment: .topTrailing) { handle(.topTrailing) }
            .overlay(alignment: .bottomLeading) { handle(.bottomLeading) }
            .overlay(alignment: .bottomTrailing) { handle(.bottomTrailing) }
            // Placed last: `position` hands back a view the size of the whole
            // canvas, so anything after it would claim the lot.
            .position(x: savedBox.midX, y: savedBox.midY)
            .offset(dragOffset)
    }

    @ViewBuilder
    private var content: some View {
        if drawsItsOwnPicture, let image = session.thumbnailsByMedia[overlay.mediaID]?.first {
            let full = OverlayFrame.isFullFrame(displayed)
            let frame = box
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
    private var selectionBorder: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                .padding(-2)
        } else if !isImage {
            // Only cutaways. A still is a solid picture wherever it is drawn
            // from, so it needs no hint about where it is, and a permanent
            // rectangle over one is a line drawn across whatever is behind it:
            // over the speaker's chin, in the case this was found in.
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(Color.white.opacity(0.22), lineWidth: 1)
                .padding(-2)
        }
    }

    @ViewBuilder
    private func handle(_ corner: CanvasResizeCorner) -> some View {
        if isSelected {
            OverlayResizeHandle(corner: corner) { phase, translation in
                resize(corner: corner, translation: translation, ended: phase)
            }
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

    /// Every step of a resize measures from where the overlay was when the
    /// handle was grabbed. Measuring from the frame it is being dragged through
    /// would compound each step into the next and run away.
    private func resize(corner: CanvasResizeCorner, translation: CGSize, ended: Bool) {
        if drag.overlayOrigin?.id != overlay.id {
            drag.beginOverlay(overlay)
            if !isSelected { session.selectOverlay(overlay.id) }
        }
        guard let origin = drag.overlayOrigin else { return }
        let aspects = session.aspects(for: origin)
        let resized = OverlayCanvasGeometry.resized(
            overlay: origin,
            translation: translation,
            corner: corner,
            canvasSize: canvasSize,
            mediaAspect: aspects.media,
            frameAspect: aspects.frame
        )
        drag.updateOverlay(resized)
        // Same as the move: the drag draws itself, and the project hears about
        // it once, at the end.
        if ended { finish() }
    }

    private func finish() {
        if let finished = drag.endOverlay() { session.commitOverlayEdit(finished) }
        onGuidesChanged([])
    }

    /// Holding Option drops an overlay exactly where the pointer is, matching
    /// the bypass the timeline and the captions already use.
    private var isSnapBypassed: Bool {
        NSEvent.modifierFlags.contains(.option)
    }
}

/// One corner grip. Reports the drag as it happens and once more when it ends,
/// so the caller can redraw cheaply and save once.
private struct OverlayResizeHandle: View {
    let corner: CanvasResizeCorner
    let onDrag: (_ ended: Bool, _ translation: CGSize) -> Void

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 9, height: 9)
            .offset(x: corner.xOffset, y: corner.yOffset)
            .contentShape(Rectangle().inset(by: -8))
            .cursor(.crosshair)
            .highPriorityGesture(
                // The handle travels with the corner it is resizing, so it can
                // no more measure against itself than the overlay can.
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { onDrag(false, $0.translation) }
                    .onEnded { onDrag(true, $0.translation) }
            )
            .accessibilityLabel("Resize overlay from \(corner.accessibilityName)")
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
