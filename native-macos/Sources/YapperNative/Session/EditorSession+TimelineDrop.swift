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
    func blocking(_ target: TimelineDropTarget, ignoring itemID: UUID) -> TimelineDropTarget {
        guard case let .overlay(lane, isNew) = target.track, !isNew else { return target }
        var checked = target
        checked.isBlocked = OverlayTracks.isOccupied(
            lane,
            by: (id: itemID, start: target.start, duration: liftedDuration(of: itemID)),
            in: overlays
        )
        return checked
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
