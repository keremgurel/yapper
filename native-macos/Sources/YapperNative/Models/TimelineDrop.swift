import Foundation

/// Where a dragged timeline item would land if it were let go right now.
///
/// One value answers the two questions a drag has to answer at every moment —
/// which track, and where along it — so the preview the creator is looking at
/// and the edit that happens on release are computed once, from the same
/// numbers, and cannot disagree.
struct TimelineDropTarget: Equatable, Sendable {
    enum Track: Equatable, Sendable {
        /// The speaker's own track. It is magnetic: clips butt up against each
        /// other, so a drop picks a position in the order rather than a time.
        case video(insertionIndex: Int)
        /// An overlay lane. `isNew` when letting go would stack another lane on
        /// top of the ones already there.
        case overlay(lane: Int, isNew: Bool)
    }

    var track: Track
    /// Where the item's leading edge lands, in timeline seconds. The magnetic
    /// video track ignores it; every other track is placed by it.
    var start: Double
    /// The guide the start was pulled onto, for drawing the line.
    var snap: TimelineSnapMatch?
    /// False when the lane under the pointer is already busy at that moment, so
    /// the preview can say so instead of the drop silently going elsewhere.
    var isBlocked = false

    var overlayLane: Int? {
        if case let .overlay(lane, _) = track { return lane }
        return nil
    }

    var isOverlay: Bool { overlayLane != nil }

    /// Where in the running order a drop on the speaker's track would go.
    var videoInsertionIndex: Int? {
        if case let .video(index) = track { return index }
        return nil
    }
}

/// Turns a pointer into a drop target.
///
/// Everything here is a pure function of the numbers the timeline already
/// knows, which is what lets the drop be tested without a mouse.
enum TimelineDropGeometry {
    /// How far above the video track the pointer has to climb before the drag
    /// commits to lifting the clip out of the edit. Deliberately generous: a
    /// wobble on the way past the caption row must not change what the drop
    /// means.
    static let liftMargin = 18.0

    /// Which track the pointer is over.
    ///
    /// - Parameter y: pointer position in the timeline content's own space.
    static func track(
        atY y: Double,
        rows: TimelineRowLayout,
        canLift: Bool
    ) -> TimelineDropTarget.Track {
        // Still over its own row, so the drag is a reorder and nothing else.
        guard canLift, y < rows.clipRowY - liftMargin else {
            return .video(insertionIndex: 0)
        }
        // Nothing is stacked up there yet, so the first lane is the new one.
        guard rows.hasOverlays else { return .overlay(lane: 0, isNew: true) }

        let stackTop = rows.overlayStackTop
        let stackBottom = stackTop + rows.overlayStackHeight
        if y >= stackBottom {
            // The band between the stack and the speaker's row belongs to the
            // captions. A clip cannot go there, so it reads as the lane just
            // above instead of as a dead zone the drag falls into.
            return .overlay(lane: 0, isNew: false)
        }
        // Above every existing lane, letting go starts a new one on top.
        if y < stackTop {
            return .overlay(lane: rows.overlayTrackCount, isNew: true)
        }
        return .overlay(lane: rows.overlayTrack(atY: y), isNew: false)
    }

    /// The full proposal, including where along the track the item lands.
    ///
    /// - Parameters:
    ///   - leadingEdgeTime: where the item's own leading edge sits under the
    ///     pointer, before snapping. Keeping the grab offset out of this is what
    ///     stops the item jumping to the cursor when the drag starts.
    ///   - stationaryDurations: durations of the video clips that are *not*
    ///     being dragged, in order, for picking an insertion index.
    ///   - latestStart: the furthest along the item may be dropped. Lifting a
    ///     clip off the video track shortens that track, so the room left for it
    ///     is not simply the length of the timeline it is still part of.
    static func target(
        pointerY: Double,
        leadingEdgeTime: Double,
        duration: Double,
        rows: TimelineRowLayout,
        stationaryDurations: [Double],
        projectDuration: Double,
        latestStart: Double? = nil,
        contentWidth: Double,
        snapAnchors: [TimelineSnapAnchor],
        isSnappingEnabled: Bool,
        canLift: Bool
    ) -> TimelineDropTarget {
        let track = track(atY: pointerY, rows: rows, canLift: canLift)
        let ceiling = max(0, latestStart ?? (projectDuration - duration))
        let clampedStart = min(ceiling, max(0, leadingEdgeTime))

        switch track {
        case .video:
            let index = TimelineReorderGeometry.insertionIndex(
                targetStart: clampedStart,
                remainingDurations: stationaryDurations
            )
            return TimelineDropTarget(
                track: .video(insertionIndex: index),
                // The track is magnetic, so the landing spot is where the clips
                // ahead of it end — not where the pointer happens to be.
                start: stationaryDurations.prefix(index).reduce(0, +)
            )
        case .overlay:
            // An overlay is placed by time, so it is the one that snaps.
            let snapped = isSnappingEnabled
                ? TimelineSnapEngine.movingMatch(
                    start: clampedStart,
                    duration: duration,
                    anchors: snapAnchors,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                : nil
            // A guide just past the end must not pull the drop out of range.
            let start = min(ceiling, max(0, snapped?.start ?? clampedStart))
            return TimelineDropTarget(
                track: track,
                start: start,
                snap: start == snapped?.start ? snapped?.match : nil
            )
        }
    }
}
