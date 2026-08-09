import SwiftUI

/// Maps between the timeline's scroll offset and the position of a scroll-bar
/// thumb. Split out from the view so the mapping stays reversible and testable.
enum TimelineScrollBarGeometry {
    static let minimumThumbWidth = 42.0

    static func thumbWidth(layout: TimelineViewportLayout, contentWidth: Double) -> Double {
        let documentWidth = layout.documentWidth(contentWidth: contentWidth)
        guard documentWidth > 0 else { return layout.viewportWidth }
        let proportional = layout.viewportWidth * layout.viewportWidth / documentWidth
        return min(layout.viewportWidth, max(minimumThumbWidth, proportional))
    }

    static func thumbX(scrollX: Double, layout: TimelineViewportLayout, contentWidth: Double) -> Double {
        let maximumScrollX = layout.maximumScrollX(contentWidth: contentWidth)
        guard maximumScrollX > 0 else { return 0 }
        let travel = layout.viewportWidth - thumbWidth(layout: layout, contentWidth: contentWidth)
        return min(travel, max(0, scrollX / maximumScrollX * travel))
    }

    static func scrollX(thumbX: Double, layout: TimelineViewportLayout, contentWidth: Double) -> Double {
        let travel = layout.viewportWidth - thumbWidth(layout: layout, contentWidth: contentWidth)
        guard travel > 0 else { return 0 }
        let maximumScrollX = layout.maximumScrollX(contentWidth: contentWidth)
        return min(maximumScrollX, max(0, thumbX / travel * maximumScrollX))
    }
}

/// Slim horizontal scroller for the timeline. The viewport draws its own offset
/// rather than living in an `NSScrollView`, so it has to draw its own scroller
/// too; without one a mouse without a horizontal axis could not pan a long
/// project.
struct TimelineScrollBar: View {
    let layout: TimelineViewportLayout
    let contentWidth: Double
    let scrollX: Double
    let onScroll: (Double) -> Void

    @State private var dragOriginX: Double?
    @State private var isHovering = false

    var body: some View {
        let thumbWidth = TimelineScrollBarGeometry.thumbWidth(layout: layout, contentWidth: contentWidth)
        let thumbX = TimelineScrollBarGeometry.thumbX(
            scrollX: scrollX,
            layout: layout,
            contentWidth: contentWidth
        )
        Capsule(style: .continuous)
            .fill(Color.primary.opacity(isHovering || dragOriginX != nil ? 0.42 : 0.24))
            .frame(width: thumbWidth, height: 7)
            .offset(x: thumbX)
            .frame(width: layout.viewportWidth, height: 11, alignment: .leading)
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let origin = dragOriginX ?? thumbX
                        dragOriginX = origin
                        onScroll(
                            TimelineScrollBarGeometry.scrollX(
                                thumbX: origin + value.translation.width,
                                layout: layout,
                                contentWidth: contentWidth
                            )
                        )
                    }
                    .onEnded { _ in dragOriginX = nil }
            )
            .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}
