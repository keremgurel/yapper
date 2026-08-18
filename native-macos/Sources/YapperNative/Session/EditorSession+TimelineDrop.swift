import Foundation

/// Carrying a timeline item out of its own row: what the drag publishes while it
/// is in the air, and the checks the landing spot has to pass.
extension EditorSession {
    func setTimelineLift(_ lift: TimelineLift?) {
        timelineDrag.setLift(lift)
    }

    /// Escape while the mouse is still down: everything goes back where it was
    /// and the rest of the gesture is ignored.
    func cancelTimelineDrag() {
        guard timelineDrag.isDragging else { return }
        timelineDrag.cancel()
        setActiveTimelineSnap(nil)
        setStatus("Drag cancelled")
    }

    /// True once Escape has been pressed, until the next drag begins.
    var isTimelineDragCancelled: Bool { timelineDrag.isCancelled }

    /// Opens a gap on the video track for something being carried down onto it,
    /// so a drop from a lane reads exactly like reordering a clip already there:
    /// the neighbours slide apart and the space it will fill is visible before
    /// the mouse comes up.
    ///
    /// - Parameter index: where in the running order it would go, or nil once
    ///   the pointer has left the track and the gap should close again.
    func previewVideoTrackInsertion(index: Int?, duration: Double) {
        guard let index else {
            guard timelineDrag.reorderPlan != nil else { return }
            timelineDrag.setOffset(0, plan: nil)
            return
        }
        if index != timelineDrag.reorderPlan?.insertionIndex {
            TimelineHaptics.settled()
        }
        timelineDrag.setOffset(
            0,
            plan: TimelineReorderPlan(insertionIndex: index, blockDuration: duration)
        )
    }

    /// Claims the drag for this item, so the tracks know their drop feedback has
    /// a live gesture behind it.
    func beginTimelineDrag(_ itemID: UUID) {
        timelineDrag.begin(itemID)
    }

    /// Releases the claim. Every gesture calls this as it ends, whatever it went
    /// on to do afterwards.
    func endTimelineDrag() {
        timelineDrag.end()
    }

    /// Drops an overlay back onto the speaker's track, at the place in the
    /// running order the pointer picked.
    func demoteOverlayToClip(_ overlayID: UUID, insertionIndex: Int) async {
        await commitTimelineEdit(successStatus: "Dropped onto the video track · ⌘Z to undo") {
            var demoted: TimelineClip?
            updateProject { demoted = $0.demoteOverlayToClip(overlayID, insertionIndex: insertionIndex) }
            guard let clip = demoted else { return false }
            selectTimelineItem(.clip(clip.id))
            return true
        }
    }

    /// The mouse came up a moment ago and something is still mid-drag, so the
    /// gesture that owned it is gone. Put the timeline back rather than leave a
    /// gap open with nothing able to close it.
    func recoverStrandedTimelineDrag() {
        guard timelineDrag.isStranded else { return }
        timelineDrag.clear()
        setActiveTimelineSnap(nil)
    }

    /// Marks a target that cannot take the item, so the preview can say so while
    /// the drag is still running rather than the drop quietly going elsewhere.
    ///
    /// - Parameter ignoring: the item being carried, which cannot collide with
    ///   itself when it is already on that lane.
    /// - Parameter reach: how far the item may be slid to sit flush against
    ///   what it landed on instead of being refused. Worked out from the zoom
    ///   by the caller, so the pull is the same handful of pixels whatever the
    ///   timeline is scaled to.
    func blocking(
        _ target: TimelineDropTarget,
        ignoring itemID: UUID,
        reach: Double = 0
    ) -> TimelineDropTarget {
        guard case let .overlay(lane, isNew) = target.track, !isNew else { return target }
        var checked = target
        let duration = liftedDuration(of: itemID)
        guard OverlayTracks.isOccupied(
            lane,
            by: (id: itemID, start: target.start, duration: duration),
            in: overlays
        ) else { return checked }

        // Up against its neighbour rather than refused, when that is what the
        // pointer was nearly asking for anyway.
        let neighbours = overlays
            .filter { $0.lane == lane && $0.id != itemID }
            .map { TimelineLaneNudge.Span(start: $0.timelineStart, duration: $0.duration) }
        if let landing = TimelineLaneNudge.flush(
            TimelineLaneNudge.Span(start: target.start, duration: duration),
            among: neighbours,
            reach: reach
        ) {
            checked.start = landing.start
            checked.snap = TimelineSnapMatch(
                time: landing.against,
                kind: .boundary,
                distancePixels: 0
            )
            return checked
        }
        checked.isBlocked = true
        return checked
    }

    /// Where a cutaway being slid along its own lane should settle: flush
    /// against the neighbour it is pushing into, if it is pushing into one.
    /// Nil when it is not, which is most of a drag.
    func laneLanding(
        for overlay: ProjectOverlay,
        reach: Double
    ) -> (start: Double, against: Double)? {
        let neighbours = overlays
            .filter { $0.lane == overlay.lane && $0.id != overlay.id }
            .map { TimelineLaneNudge.Span(start: $0.timelineStart, duration: $0.duration) }
        return TimelineLaneNudge.flush(
            TimelineLaneNudge.Span(start: overlay.timelineStart, duration: overlay.duration),
            among: neighbours,
            reach: reach
        )
    }

    /// How long the item being carried is, whichever kind it is.
    private func liftedDuration(of itemID: UUID) -> Double {
        if let clip = project.clips.first(where: { $0.id == itemID }) { return clip.duration }
        if let overlay = overlays.first(where: { $0.id == itemID }) { return overlay.duration }
        return 0
    }
}

extension TimelineClip {
    /// Where this clip starts on the edited timeline. The video track is
    /// magnetic, so a clip's position is the sum of everything before it.
    func timelineStart(in project: EditorProject) -> Double {
        project.timelineStart(for: id) ?? 0
    }
}
