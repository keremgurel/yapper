import CoreGraphics
import Foundation

enum TimelineSelectionItem: Hashable, Sendable {
    case clip(UUID)
    case text(UUID)
    case overlay(UUID)
    case caption(UUID)
    case audio(UUID)

    var id: UUID {
        switch self {
        case let .clip(id), let .text(id), let .overlay(id), let .caption(id), let .audio(id): id
        }
    }
}

enum TimelineEditEdge: Equatable, Sendable {
    case leading
    case trailing
}

struct TimelineItemFrame: Equatable, Sendable {
    let item: TimelineSelectionItem
    let frame: CGRect
}

enum TimelineMarqueeGeometry {
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect {
        CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
    }

    static func selection(
        intersecting marquee: CGRect,
        itemFrames: [TimelineItemFrame],
        base: Set<TimelineSelectionItem> = [],
        additive: Bool = false,
        toggling: Bool = false
    ) -> Set<TimelineSelectionItem> {
        let hits = Set(
            itemFrames
                .filter { $0.frame.intersects(marquee) }
                .map(\.item)
        )
        if toggling { return base.symmetricDifference(hits) }
        if additive { return base.union(hits) }
        return hits
    }
}

extension TimelineSelectionItem {
    /// Whether two picks are the same kind of thing. A run only ever reaches
    /// across one track: shift-clicking a caption after a clip is a new start,
    /// not a range from one to the other.
    func isSameKind(as other: TimelineSelectionItem) -> Bool {
        switch (self, other) {
        case (.clip, .clip), (.text, .text), (.overlay, .overlay),
             (.caption, .caption), (.audio, .audio): true
        default: false
        }
    }
}
