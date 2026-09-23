import SwiftUI

/// Two columns at three to two when the page is wide enough for the narrow
/// side to keep 320pt; stacked otherwise. Mirrors the web's
/// `xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]`.
struct HomeSplitLayout: Layout {
    var spacing: CGFloat = 32
    var breakpoint: CGFloat = 960

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? breakpoint
        let frames = place(width: width, subviews: subviews)
        let height = frames.map(\.maxY).max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (subview, frame) in zip(subviews, place(width: bounds.width, subviews: subviews)) {
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(width: frame.width, height: frame.height)
            )
        }
    }

    private func place(width: CGFloat, subviews: Subviews) -> [CGRect] {
        guard subviews.count == 2 else {
            var y: CGFloat = 0
            return subviews.map { subview in
                let height = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
                defer { y += height + spacing }
                return CGRect(x: 0, y: y, width: width, height: height)
            }
        }
        if width >= breakpoint {
            let usable = width - spacing
            let right = max(320, usable * 2 / 5)
            let left = usable - right
            let leftHeight = subviews[0].sizeThatFits(ProposedViewSize(width: left, height: nil)).height
            let rightHeight = subviews[1].sizeThatFits(ProposedViewSize(width: right, height: nil)).height
            return [
                CGRect(x: 0, y: 0, width: left, height: leftHeight),
                CGRect(x: left + spacing, y: 0, width: right, height: rightHeight),
            ]
        }
        let top = subviews[0].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
        let bottom = subviews[1].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
        return [
            CGRect(x: 0, y: 0, width: width, height: top),
            CGRect(x: 0, y: top + spacing, width: width, height: bottom),
        ]
    }
}
