import Foundation
import SwiftUI

/// Gives SwiftUI ownership of a viewport without making the view that owns the
/// lifetime observe every pixel it publishes. The ruler, content transform,
/// zoom control, and scrollbar subscribe directly; fixed timeline chrome does
/// not redraw while the timeline moves underneath it.
@MainActor
final class TimelineViewportOwner: ObservableObject {
    let viewport: TimelineViewportState

    init(viewport: TimelineViewportState = TimelineViewportState()) {
        self.viewport = viewport
    }
}

/// Owns the timeline's horizontal zoom scale and scroll offset.
///
/// The two are published together in one transaction so SwiftUI lays out the
/// new content width and the new offset in the same frame. Letting an
/// `NSScrollView` own the offset instead cost a frame between the resize and
/// the anchor correction, which is what made clips slide out from under the
/// pointer on every zoom step.
@MainActor
final class TimelineViewportState: ObservableObject {
    private struct Snapshot: Equatable {
        let pointsPerSecond: Double
        let scrollX: Double
    }

    /// One publication for one visual update. A zoom changes both values, and
    /// separate `@Published` properties emitted twice before SwiftUI could draw
    /// once, waking every viewport subscriber twice for the same frame.
    @Published private var snapshot: Snapshot

    var pointsPerSecond: Double { snapshot.pointsPerSecond }
    var scrollX: Double { snapshot.scrollX }

    init(pointsPerSecond: Double = 36) {
        snapshot = Snapshot(pointsPerSecond: pointsPerSecond, scrollX: 0)
    }

    /// Zooms by `factor`, keeping whatever sits at `anchorX` (viewport
    /// coordinates) pinned to `anchorX`.
    func zoom(by factor: Double, anchorX: Double, layout: TimelineViewportLayout) {
        setPointsPerSecond(
            TimelineZoomGeometry.scaled(pointsPerSecond, by: factor),
            anchorX: anchorX,
            layout: layout
        )
    }

    func setPointsPerSecond(_ value: Double, anchorX: Double, layout: TimelineViewportLayout) {
        let updated = min(
            TimelineZoomGeometry.scaleRange.upperBound,
            max(TimelineZoomGeometry.scaleRange.lowerBound, value)
        )
        guard abs(updated - pointsPerSecond) > 0.000_1 else { return }
        apply(
            pointsPerSecond: updated,
            scrollX: TimelineZoomGeometry.anchoredOffset(
                oldOffset: scrollX,
                pointerX: anchorX,
                oldContentWidth: layout.contentWidth(at: pointsPerSecond),
                newContentWidth: layout.contentWidth(at: updated),
                viewportWidth: layout.viewportWidth,
                leadingInset: layout.leadingInset,
                trailingInset: layout.trailingInset
            )
        )
    }

    func pan(by delta: Double, layout: TimelineViewportLayout) {
        scroll(to: scrollX + delta, layout: layout)
    }

    func scroll(to offset: Double, layout: TimelineViewportLayout) {
        let target = layout.clampedScrollX(
            offset,
            contentWidth: layout.contentWidth(at: pointsPerSecond)
        )
        guard abs(target - scrollX) > 0.000_1 else { return }
        apply(pointsPerSecond: pointsPerSecond, scrollX: target)
    }

    /// Pulls the offset back in range after the panel resizes or the project
    /// duration changes underneath it.
    func reconcile(with layout: TimelineViewportLayout) {
        scroll(to: scrollX, layout: layout)
    }

    private func apply(pointsPerSecond newScale: Double, scrollX newOffset: Double) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            snapshot = Snapshot(
                pointsPerSecond: newScale,
                scrollX: newOffset
            )
        }
    }
}
