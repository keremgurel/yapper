import SwiftUI

/// Draws the scrollable part of the timeline at its own offset.
///
/// The content keeps its full width and is translated by `-scrollX`, so a zoom
/// step is a single SwiftUI update that changes the width and the offset
/// together. Nothing observes the resize after the fact and corrects for it,
/// which is what keeps the point under the pointer exactly where it was.
struct TimelineViewport: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var viewport: TimelineViewportState
    let layout: TimelineViewportLayout
    let contentHeight: Double

    /// Pinch reports its scale relative to the start of the gesture, so the
    /// previous value is kept to turn it into a per-update factor.
    @State private var lastMagnification = 1.0

    var body: some View {
        let contentWidth = layout.contentWidth(at: viewport.pointsPerSecond)
        TimelineContent(
            session: session,
            contentWidth: contentWidth,
            visibleRange: TimelineVisibleRange.make(
                scrollX: viewport.scrollX,
                viewportWidth: layout.viewportWidth,
                contentWidth: contentWidth,
                duration: session.duration
            )
        )
            .frame(width: contentWidth, height: contentHeight)
            .padding(.leading, layout.leadingInset)
            .padding(.trailing, layout.trailingInset)
            .offset(x: -viewport.scrollX)
            .frame(width: layout.viewportWidth, height: contentHeight, alignment: .leading)
            .clipped()
            // Pinch runs as a gesture rather than through the scroll monitor:
            // `.magnify` events never reached a local NSEvent monitor here.
            .simultaneousGesture(magnifyGesture)
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let ratio = value.magnification / lastMagnification
                lastMagnification = value.magnification
                viewport.zoom(
                    by: TimelineZoomGeometry.pinchFactor(ratio: ratio),
                    anchorX: value.startAnchor.x * layout.viewportWidth,
                    layout: layout
                )
            }
            .onEnded { _ in lastMagnification = 1 }
    }
}
