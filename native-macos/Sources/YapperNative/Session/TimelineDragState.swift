import Foundation

/// Live feedback for a timeline drag: how far the selection has moved, where it
/// would land, and which guide it is snapping to.
///
/// This is separate from `EditorSession` for the same reason the playback clock
/// is. A drag updates on every mouse move, and publishing that on the session
/// rebuilt the transcript, the player and the inspector on every frame of it.
/// Only the timeline tracks care, so only they observe this.
@MainActor
final class TimelineDragState: ObservableObject {
    /// Signed seconds the dragged selection is currently offset by.
    @Published private(set) var offset = 0.0
    /// Where the drop will insert the dragged block, so the track can open the
    /// gap it will fill.
    @Published private(set) var reorderPlan: TimelineReorderPlan?
    /// The guide the drag is currently snapping to.
    @Published private(set) var snap: TimelineSnapMatch?
    /// Where a drag that has left its own row would land. Nil while the drag is
    /// still a plain reorder, so the tracks only draw a landing spot once there
    /// is somewhere else to land.
    @Published private(set) var lift: TimelineLift?

    /// Set by Escape. The gesture is still running — the mouse has not come up —
    /// so the drag has to be told to stop listening to it rather than being
    /// taken away from it.
    @Published private(set) var isCancelled = false

    /// The item whose gesture is running right now.
    ///
    /// The tracks draw their drop feedback off this rather than off the plan.
    /// A plan is a leftover the moment its gesture is gone, and a leftover plan
    /// is what drew a gap the creator could not close — so nothing is drawn
    /// unless a live gesture is claiming it.
    @Published private(set) var activeItemID: UUID?

    var isDragging: Bool { activeItemID != nil }
    /// Anything at all still set. Checked shortly after the mouse comes up, by
    /// which time a healthy drag has cleaned up after itself.
    var isStranded: Bool {
        activeItemID != nil || offset != 0 || reorderPlan != nil || lift != nil
    }

    /// Called on the first frame of a drag: claims the drag and clears any
    /// cancellation, so a cancelled drag cannot poison the next one.
    func begin(_ itemID: UUID) {
        if isCancelled { isCancelled = false }
        guard activeItemID != itemID else { return }
        activeItemID = itemID
    }

    /// Claims the drag for a gesture that did not name itself. Every kind of
    /// timeline cell can push a reorder preview, and each of them owning the
    /// claim by hand is one more place to forget.
    func claimIfNeeded() {
        guard activeItemID == nil else { return }
        activeItemID = UUID()
    }

    /// Called when the gesture ends, however it ends.
    func end() {
        guard activeItemID != nil else { return }
        activeItemID = nil
    }

    func cancel() {
        clear()
        end()
        guard !isCancelled else { return }
        isCancelled = true
    }

    func setOffset(_ value: Double, plan: TimelineReorderPlan?) {
        // Redundant publishes are what make a drag expensive, so identical
        // frames stop here rather than at the view.
        guard value != offset || plan != reorderPlan else { return }
        offset = value
        reorderPlan = plan
    }

    func setSnap(_ match: TimelineSnapMatch?) {
        guard match != snap else { return }
        snap = match
    }

    func setLift(_ value: TimelineLift?) {
        guard value != lift else { return }
        // One tap when the landing spot moves to a different row, and none for
        // the pointer sliding along inside the row it has already chosen.
        if value?.target.track != lift?.target.track {
            TimelineHaptics.settled()
        }
        lift = value
    }

    /// Wipes the feedback without letting go of the drag.
    ///
    /// Deliberately does *not* release the claim: a drag clears its reorder
    /// preview the moment the item is carried off its own row, and it is still
    /// very much a live drag at that point. Releasing here is what stopped the
    /// drop line ever being drawn. Ending is the gesture's job, and the watchdog
    /// covers a gesture that never gets to do it.
    func clear() {
        setOffset(0, plan: nil)
        setSnap(nil)
        setLift(nil)
    }
}

/// A timeline item being carried out of its own row, and the spot it would drop
/// into. Everything the preview needs to draw itself, so the tracks never have
/// to reach back into the gesture that started it.
struct TimelineLift: Equatable, Sendable {
    let itemID: UUID
    let title: String
    /// Length of what is being carried, in seconds.
    let duration: Double
    let target: TimelineDropTarget
}
