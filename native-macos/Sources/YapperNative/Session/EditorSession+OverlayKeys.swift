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
        let updated: ProjectOverlay
        if OverlayKeyTrack.key(of: overlay, at: time) != nil {
            updated = OverlayKeyTrack.removingKey(at: time, in: overlay)
            setStatus("Keyframe removed")
        } else {
            updated = OverlayKeyTrack.setting(
                OverlayBox(
                    x: overlay.x,
                    y: overlay.y,
                    width: overlay.width,
                    height: overlay.height
                ),
                at: time,
                in: overlay
            )
            setStatus("Keyframe added at \(formatTime(currentTime))")
        }
        writeOverlay(updated)
    }

    func clearOverlayKeys(_ overlay: ProjectOverlay) {
        guard OverlayKeyTrack.isKeyed(overlay) else { return }
        writeOverlay(OverlayKeyTrack.clearingKeys(at: overlayTime(of: overlay), in: overlay))
        setStatus("Keyframes cleared")
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
        let moved = OverlayKeyTrack.movingKey(at: from, to: destination, in: overlay)
        guard moved != overlay else { return }
        writeOverlay(moved)
    }

    func removeOverlayKey(_ overlay: ProjectOverlay, at time: Double) {
        let updated = OverlayKeyTrack.removingKey(at: time, in: overlay)
        guard updated != overlay else { return }
        writeOverlay(updated, successStatus: "Keyframe removed")
    }

    private func writeOverlay(_ updated: ProjectOverlay, successStatus: String = "Ready") {
        scheduleCompositionCommit(
            settleFor: .milliseconds(50),
            successStatus: successStatus
        ) { [self] in
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == updated.id })
                else { return }
                project.overlays?[index] = updated
                project.updatedAt = Date()
            }
            selectedOverlayID = updated.id
            return true
        }
    }
}
