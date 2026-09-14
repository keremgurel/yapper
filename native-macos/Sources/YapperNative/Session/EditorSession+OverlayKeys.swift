import Foundation

/// Keyframing a cutaway: the diamond, the arrows, and moving a key by hand.
///
/// The overlay half of `EditorSession+FramingKeys`, kept deliberately parallel
/// to it. Two features that behave the same way should read the same way, or
/// the second one is a thing to be learned rather than a thing you already know.
@MainActor
extension EditorSession {
    func isOverlayKeyed(_ overlay: ProjectOverlay) -> Bool {
        OverlayKeyTrack.isKeyed(overlay)
    }

    func overlayKeys(_ overlay: ProjectOverlay) -> [OverlayKey] {
        OverlayKeyTrack.keys(of: overlay)
    }

    func overlayKeyAtPlayhead(_ overlay: ProjectOverlay) -> OverlayKey? {
        OverlayKeyTrack.key(of: overlay, at: overlayTime(of: overlay))
    }

    /// Whether the playhead is anywhere inside this cutaway, which is the only
    /// place a key can be put.
    func isPlayheadOver(_ overlay: ProjectOverlay) -> Bool {
        currentTime >= overlay.timelineStart - 0.001
            && currentTime <= overlay.timelineStart + overlay.duration + 0.001
    }

    // MARK: - The diamond

    func toggleOverlayKey(_ overlay: ProjectOverlay) {
        guard isPlayheadOver(overlay) else {
            setStatus("Move the playhead over the cutaway to key it")
            return
        }
        let time = overlayTime(of: overlay)
        runOverlayKeyAction(overlay, at: time,
            operation: OverlayKeyTrack.key(of: overlay, at: time) == nil ? .set : .remove)
    }

    func clearOverlayKeys(_ overlay: ProjectOverlay) {
        runOverlayKeyAction(overlay, at: overlayTime(of: overlay), operation: .clear)
    }

    // MARK: - The arrows

    func hasPreviousOverlayKey(_ overlay: ProjectOverlay) -> Bool {
        OverlayKeyTrack.previousKey(of: overlay, before: overlayTime(of: overlay)) != nil
    }

    func hasNextOverlayKey(_ overlay: ProjectOverlay) -> Bool {
        OverlayKeyTrack.nextKey(of: overlay, after: overlayTime(of: overlay)) != nil
    }

    func goToPreviousOverlayKey(_ overlay: ProjectOverlay) {
        guard
            let key = OverlayKeyTrack.previousKey(of: overlay, before: overlayTime(of: overlay))
        else { return }
        seekToTimelineTime(overlay.timelineStart + key.at)
    }

    func goToNextOverlayKey(_ overlay: ProjectOverlay) {
        guard let key = OverlayKeyTrack.nextKey(of: overlay, after: overlayTime(of: overlay))
        else { return }
        seekToTimelineTime(overlay.timelineStart + key.at)
    }

    // MARK: - Dragging one on the timeline

    /// Moves a key along its own cutaway. Held between its neighbours by
    /// `OverlayKeyTrack`, so a drag can neither reorder the move nor stack two
    /// keys on one moment.
    func moveOverlayKey(_ overlay: ProjectOverlay, from: Double, to destination: Double) {
        runOverlayKeyAction(overlay, at: from, operation: .move, destination: destination)
    }

    func removeOverlayKey(_ overlay: ProjectOverlay, at time: Double) {
        runOverlayKeyAction(overlay, at: time, operation: .remove)
    }

    private func runOverlayKeyAction(_ overlay: ProjectOverlay, at time: Double,
                                     operation: OverlayKeyOperation, destination: Double? = nil) {
        Task {
            await performAppAction(OverlayKeyframeInput(overlayID: overlay.id, time: time,
                operation: operation, destination: destination, box: nil, crop: nil))
        }
    }
}
