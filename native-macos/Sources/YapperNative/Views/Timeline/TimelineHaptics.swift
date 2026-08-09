@preconcurrency import AppKit

/// The taps the trackpad gives back during a timeline drag.
///
/// A drag crosses dozens of anchors a second, and tapping at every one of them
/// turns the trackpad into a buzzer — the feedback stops meaning anything. So a
/// tap is reserved for the moments a decision actually changes: landing on an
/// edge worth landing on, and the drop settling somewhere new.
@MainActor
enum TimelineHaptics {
    /// Two taps closer together than this read as one long buzz rather than as
    /// two separate events, so the second is dropped.
    private static let minimumInterval = 0.07
    private static var lastFired = Date.distantPast

    /// Landed on a guide. Only the edges a creator aims for: the playhead and
    /// real cut boundaries. Second marks and audio transients are everywhere,
    /// and tapping for those is what made the whole drag rattle.
    static func snapped(to kind: TimelineSnapKind) {
        guard kind == .playhead || kind == .boundary else { return }
        perform(.alignment)
    }

    /// The drop moved somewhere new: another place in the running order, another
    /// lane, another track. One tap per change, however small the mouse move
    /// that caused it.
    static func settled() {
        perform(.levelChange)
    }

    private static func perform(_ pattern: NSHapticFeedbackManager.FeedbackPattern) {
        let now = Date()
        guard now.timeIntervalSince(lastFired) >= minimumInterval else { return }
        lastFired = now
        NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .now)
    }
}
