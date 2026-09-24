import AppKit
import SwiftUI

/// The line between the writing and the details panel. A hairline to look at
/// and a wider strip to grab: dragging it sets the panel's width, which the
/// app remembers; double-click puts it back to the default.
struct IdeaCanvasSplitHandle: View {
    @Binding var sideWidth: Double
    static let range: ClosedRange<Double> = 280...560
    static let standard: Double = 360

    @State private var start: Double?
    @State private var hovering = false

    var body: some View {
        Rectangle()
            .fill(hovering || start != nil ? Color.studioLineStrong : Color.studioLine)
            .frame(width: 1)
            .frame(maxHeight: .infinity)
            .padding(.horizontal, 5)
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .cursor(.resizeLeftRight)
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        let origin = start ?? sideWidth
                        start = origin
                        // The panel is on the right: dragging left widens it.
                        sideWidth = min(max(origin - value.translation.width, Self.range.lowerBound), Self.range.upperBound)
                    }
                    .onEnded { _ in start = nil }
            )
            .onTapGesture(count: 2) {
                withAnimation(.snappy(duration: 0.2)) { sideWidth = Self.standard }
            }
            .accessibilityLabel("Resize the details panel")
    }
}
