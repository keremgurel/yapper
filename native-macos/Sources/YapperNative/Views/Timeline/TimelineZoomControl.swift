import SwiftUI

/// The zoom slider at the end of the timeline toolbar.
///
/// The only toolbar control that follows viewport scale, so horizontal panning
/// does not ask SwiftUI to rebuild the fixed action buttons beside it.
struct TimelineZoomControl: View {
    @ObservedObject var viewport: TimelineViewportState
    let layout: TimelineViewportLayout

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "minus.magnifyingglass")
            Slider(value: zoom, in: TimelineZoomGeometry.scaleRange)
                .frame(width: 120)
                .controlSize(.mini)
                .help("Pinch or ⌘-scroll over the timeline to zoom")
                .accessibilityLabel("Timeline zoom")
            Image(systemName: "plus.magnifyingglass")
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Color.studioTextMuted)
        .fixedSize()
    }

    /// The slider has no pointer to anchor to, so it zooms about the middle of
    /// the viewport the way the zoom control in any editor does.
    private var zoom: Binding<Double> {
        Binding(
            get: { viewport.pointsPerSecond },
            set: { value in
                viewport.setPointsPerSecond(
                    value,
                    anchorX: layout.viewportWidth / 2,
                    layout: layout
                )
            }
        )
    }
}
