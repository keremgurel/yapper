@preconcurrency import AppKit
import SwiftUI

/// The overlays that are on screen right now, drawn over the player and
/// draggable there.
///
/// An image is drawn here in full, because Core Animation only burns it in at
/// export. A video cutaway is already coming out of the player itself, so this
/// layer draws nothing over it and only offers the frame you grab to move it.
struct OverlayCanvasLayer: View {
    @ObservedObject var session: EditorSession
    /// Watched only so a keyed overlay moves as the playhead does. The cursor
    /// below publishes when the *set* of visible items changes, which is the
    /// right grain for everything except something that is moving.
    @ObservedObject var clock: PlaybackClock
    /// The playhead is observed here rather than through the session so the
    /// rest of the editor is not rebuilt on every frame of playback.
    /// Watches what is on screen, not the clock. Watching the clock rebuilt
    /// this layer thirty times a second throughout playback, which is also
    /// every drag frame's worth of work landing on top of the drag.
    @ObservedObject var cursor: PlaybackCursor
    /// Owned here rather than in the item so the lines can span the whole stage
    /// instead of being clipped to the overlay being dragged.
    @StateObject private var guides = CanvasGuidePresenter()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(visibleOverlays) { overlay in
                    OverlayCanvasItem(
                        session: session,
                        // Where it is at this moment, which for a keyed cutaway
                        // is a different box every frame.
                        overlay: session.displayedOverlay(overlay),
                        canvasSize: proxy.size,
                        isSelected: session.selectedOverlayID == overlay.id,
                        onGuidesChanged: { guides.show($0) },
                        drag: session.canvasDrag
                    )
                    .id(overlay.id)
                }

                CanvasGuideOverlay(guides: guides.guides, canvasSize: proxy.size)
                    .zIndex(20)
            }
        }
        .clipped()
    }

    /// Back to front by lane, so a higher lane draws over a lower one and is
    /// the one a click lands on.
    ///
    /// This used to be project order, which is the order they were added. The
    /// export has always gone by lane, so a cutaway moved up a lane sat on top
    /// in the finished video and underneath in the preview — the one place you
    /// would check it.
    private var visibleOverlays: [ProjectOverlay] {
        let onScreen = cursor.canvasItems.overlayIDs
        return OverlayTracks.backToFront(session.overlays).filter { onScreen.contains($0.id) }
    }
}
