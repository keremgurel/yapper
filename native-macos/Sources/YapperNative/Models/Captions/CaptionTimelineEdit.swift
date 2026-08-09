import Foundation

/// Dragging a caption card along the timeline.
///
/// Cards are anchored in recording seconds, not timeline seconds, which is what
/// lets a trim or a restored cut re-place every card automatically. Moving one
/// by hand therefore means working out which recording second the creator
/// dropped it on and writing that back.
///
/// It also fixes the card's words. A card that has not been typed into shows
/// whatever words fall inside its stretch of the recording, so a card dragged
/// two seconds later would otherwise arrive saying something else entirely. The
/// moment a card is moved by hand, the text on it is the creator's.
enum CaptionTimelineEdit {
    /// The shortest card worth having on the timeline.
    static let minimumDuration = 0.12

    /// The card retimed to show from `start` to `end` in timeline seconds, or
    /// nil when that stretch does not belong to the recording this card came
    /// from: a card cannot be dragged onto footage it was never spoken over.
    static func retimed(
        _ caption: ProjectCaption,
        text: String,
        toTimelineStart start: Double,
        end: Double,
        in project: EditorProject
    ) -> ProjectCaption? {
        guard end - start >= minimumDuration else { return nil }
        guard
            let head = project.captionAnchor(atTimelineTime: start),
            let tail = project.captionAnchor(atTimelineTime: end),
            head.mediaID == caption.mediaID,
            tail.mediaID == caption.mediaID,
            tail.sourceTime - head.sourceTime >= minimumDuration
        else { return nil }

        var retimed = caption
        retimed.sourceStart = head.sourceTime
        retimed.sourceEnd = tail.sourceTime
        // What it says now is what it says from now on.
        retimed.text = text
        retimed.isTextEdited = true
        return retimed
    }

    /// Where a card can be moved to without running off either end of the
    /// timeline, keeping its length.
    static func clampedStart(
        _ start: Double,
        duration: Double,
        projectDuration: Double
    ) -> Double {
        min(max(0, projectDuration - duration), max(0, start))
    }

    /// The stretch of timeline a card is drawn across while it is being
    /// dragged. Cards have no stored timeline position of their own, so a drag
    /// works on this and only writes back when it ends.
    struct Span: Equatable, Sendable {
        var start: Double
        var end: Double

        var duration: Double { max(0, end - start) }
    }

    static func moved(
        span: Span,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> Span {
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let start = clampedStart(
            span.start + delta,
            duration: span.duration,
            projectDuration: projectDuration
        )
        return Span(start: start, end: start + span.duration)
    }

    static func trimmed(
        span: Span,
        edge: TimelineEditEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> Span {
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        switch edge {
        case .leading:
            return Span(
                start: min(span.end - minimumDuration, max(0, span.start + delta)),
                end: span.end
            )
        case .trailing:
            return Span(
                start: span.start,
                end: max(
                    span.start + minimumDuration,
                    min(projectDuration, span.end + delta)
                )
            )
        }
    }
}
