@preconcurrency import AppKit
import SwiftUI

/// The handful of behaviours every timeline cell shares: how a click selects,
/// how a group drag resolves, and when snapping steps aside.
///
/// They live here rather than beside one cell because clips, text, overlays,
/// captions and audio all answer to them, and a rule that only some of the
/// tracks followed would be worse than no rule at all.

/// Holding Option drops a clip exactly where the pointer is.
var isTimelineSnapTemporarilyBypassed: Bool {
    NSEvent.modifierFlags.contains(.option)
}

@MainActor
func selectTimelineItemFromPointer(
    _ item: TimelineSelectionItem,
    session: EditorSession
) {
    let flags = NSEvent.modifierFlags
    session.selectTimelineItem(
        item,
        additive: flags.contains(.shift),
        toggling: flags.contains(.command)
    )
    // Only a plain click: adding to a selection is about the timeline, and
    // moving the playhead under someone building a multi-selection would be a
    // surprise.
    guard !flags.contains(.shift), !flags.contains(.command) else { return }
    session.revealOnCanvas(item)
}

@MainActor
func timelineSelectionMove(
    session: EditorSession,
    bounds: (start: Double, end: Double),
    rawTranslationX: CGFloat,
    contentWidth: Double,
    snapAnchors: [TimelineSnapAnchor]
) -> (delta: Double, match: TimelineSnapMatch?) {
    let rawDelta = TimelineTrimGeometry.timeDelta(
        for: rawTranslationX,
        contentWidth: contentWidth,
        projectDuration: session.duration
    )
    guard session.isTimelineSnappingEnabled,
          !isTimelineSnapTemporarilyBypassed,
          let snapped = TimelineSnapEngine.movingMatch(
            start: bounds.start + rawDelta,
            duration: bounds.end - bounds.start,
            anchors: snapAnchors,
            contentWidth: contentWidth,
            projectDuration: session.duration
          ) else { return (rawDelta, nil) }
    return (snapped.start - bounds.start, snapped.match)
}

