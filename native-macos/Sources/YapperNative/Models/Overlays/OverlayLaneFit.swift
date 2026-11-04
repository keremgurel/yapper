import Foundation

/// Where retimed overlays end up when their lane is taken at the new time.
///
/// Moving or stretching an overlay used to fail outright when anything else
/// sat on its lane at the new time. In a Chirpy plan that also placed new
/// overlays, the new ones had already taken the free lanes, so moving the live
/// call failed the whole plan with "That overlay lane is occupied", and the
/// same request split into two messages went through. A lane is bookkeeping,
/// not something the creator asked for, so a retimed overlay now moves up to
/// the lowest lane that is free for its new span. A lane the request named
/// explicitly is still honoured or refused, never silently changed.
enum OverlayLaneFit {
    static func settle(
        _ moved: [ProjectOverlay],
        among others: [ProjectOverlay],
        keepingRequestedLane: Bool
    ) throws -> [ProjectOverlay] {
        var placed: [ProjectOverlay] = []
        for var overlay in moved {
            // Checked against everything already settled, so two overlays
            // moved together cannot land on each other either.
            let around = others + placed
            let span = (overlay.id, overlay.timelineStart, overlay.duration)
            if OverlayTracks.isOccupied(overlay.lane, by: span, in: around) {
                guard !keepingRequestedLane else {
                    throw AppActionError("That overlay lane is occupied at the requested time.")
                }
                let free = OverlayTracks.firstFreeTrack(for: span, in: around)
                overlay.track = free == 0 ? nil : free
            }
            placed.append(overlay)
        }
        return placed
    }
}
