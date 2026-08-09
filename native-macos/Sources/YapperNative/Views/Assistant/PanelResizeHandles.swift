@preconcurrency import AppKit
import SwiftUI

/// The grab zones around the whole edge of a floating panel.
///
/// Every edge and every corner, not one grip in the bottom right. A panel you
/// can only make bigger downward and to the right is one you have to drag back
/// across the window every time you want more room above it.
///
/// The strips hang slightly outside the panel as well as inside, so the target
/// is a comfortable width without eating into what the panel is showing.
struct PanelResizeHandles: View {
    let onResize: (PanelResizeEdge, CGSize) -> Void
    let onEnded: () -> Void

    /// How wide the grab strip is. Wider than the hairline it sits on, because
    /// the border is a drawing and this is a target.
    private static let thickness: CGFloat = 7
    /// Corners win over the edges they meet, so a pull from the very corner
    /// takes both axes rather than whichever edge happened to be on top.
    private static let corner: CGFloat = 16

    var body: some View {
        ZStack {
            edge(.top)
            edge(.bottom)
            edge(.leading)
            edge(.trailing)
            corner(.topLeading)
            corner(.topTrailing)
            corner(.bottomLeading)
            corner(.bottomTrailing)
        }
        // Reaches a little past the panel so the outermost pixels of the edge
        // are grabbable, which is where a pointer naturally lands.
        .padding(-3)
    }

    private func edge(_ edge: PanelResizeEdge) -> some View {
        zone(edge)
            .frame(
                width: edge.isVertical ? nil : Self.thickness,
                height: edge.isVertical ? Self.thickness : nil
            )
            // Stops short of the corners, which have their own zone.
            .padding(edge.isVertical ? .horizontal : .vertical, Self.corner)
            .frame(
                maxWidth: .infinity,
                maxHeight: .infinity,
                alignment: alignment(for: edge)
            )
    }

    private func corner(_ corner: PanelResizeEdge) -> some View {
        zone(corner)
            .frame(width: Self.corner, height: Self.corner)
            .frame(
                maxWidth: .infinity,
                maxHeight: .infinity,
                alignment: alignment(for: corner)
            )
    }

    private func zone(_ edge: PanelResizeEdge) -> some View {
        Color.clear
            .contentShape(Rectangle())
            .cursor(cursor(for: edge))
            .gesture(
                // Against the screen: the panel is moving under the pointer as
                // it is resized, so measuring in its own space would report
                // half of every step. See CanvasCoordinateSpace.
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { onResize(edge, $0.translation) }
                    .onEnded { _ in onEnded() }
            )
    }

    private func alignment(for edge: PanelResizeEdge) -> Alignment {
        switch edge {
        case .top: .top
        case .bottom: .bottom
        case .leading: .leading
        case .trailing: .trailing
        case .topLeading: .topLeading
        case .topTrailing: .topTrailing
        case .bottomLeading: .bottomLeading
        case .bottomTrailing: .bottomTrailing
        }
    }

    /// AppKit has no public diagonal resize pointer before macOS 15, so the
    /// corners take the crosshair the canvas handles already use rather than a
    /// private cursor that could vanish under us.
    private func cursor(for edge: PanelResizeEdge) -> NSCursor {
        if edge.isCorner { return .crosshair }
        return edge.isVertical ? .resizeUpDown : .resizeLeftRight
    }
}
