import AppKit

/// Widens a split view divider's grab region without widening the hairline it
/// draws.
///
/// A divider only a few points wide is honest visually but miserable to hit:
/// the resize cursor flickers on and off and the drag misses. AppKit's
/// `additionalEffectiveRectOfDividerAt` exists for exactly this — the returned
/// rect joins the divider's tracking area, so both the cursor and the drag pick
/// up well before the pointer reaches the line itself.
enum SplitDividerHitArea {
    /// Extra grabbable margin on each side of the divider.
    static let padding: CGFloat = 8

    static func additionalRect(
        in splitView: NSSplitView,
        dividerIndex: Int
    ) -> NSRect {
        guard splitView.subviews.indices.contains(dividerIndex) else { return .zero }
        let leading = splitView.subviews[dividerIndex].frame
        if splitView.isVertical {
            return NSRect(
                x: leading.maxX - padding,
                y: 0,
                width: splitView.dividerThickness + padding * 2,
                height: splitView.bounds.height
            )
        }
        return NSRect(
            x: 0,
            y: leading.maxY - padding,
            width: splitView.bounds.width,
            height: splitView.dividerThickness + padding * 2
        )
    }
}

/// The editor's split view chrome: a hairline divider, a comfortable grab
/// region around it, and double-click to restore the default position.
class StudioSplitView: NSSplitView {
    var resetPosition: (() -> Void)?

    override var dividerThickness: CGFloat { 7 }

    override func drawDivider(in rect: NSRect) {
        NSColor.separatorColor.withAlphaComponent(0.7).setFill()
        if isVertical {
            NSRect(x: rect.midX - 0.5, y: rect.minY, width: 1, height: rect.height).fill()
        } else {
            NSRect(x: rect.minX, y: rect.midY - 0.5, width: rect.width, height: 1).fill()
        }
    }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            resetPosition?()
            return
        }
        super.mouseDown(with: event)
    }
}
