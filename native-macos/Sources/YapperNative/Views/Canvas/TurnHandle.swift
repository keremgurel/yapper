@preconcurrency import AppKit
import SwiftUI

/// The rotate handle, in two halves: the ring you can see and the pad you can
/// grab.
///
/// They are two views rather than one for the reason the corner handles are.
/// Anything that owns a drag has to stand still while it is held: a grip that
/// travels with the thing it is changing leaves the pointer behind, SwiftUI
/// answers by cancelling the drag and offering a fresh one, and every restart
/// throws away the movement it began with. A rotate grip sweeps an arc, which is
/// the fastest-moving grip in the editor, so it lost the most.
///
/// So the ring follows the item round and takes no clicks, and the pad is held
/// where the gesture started until it is let go.

/// The part you can see. Drawn as a ring rather than a square so it never reads
/// as a fifth corner.
struct TurnRing: View {
    var diameter: CGFloat = 11

    var body: some View {
        Circle()
            .fill(Color.white)
            .overlay { Circle().stroke(Color.yapperOrange, lineWidth: 1.5) }
            .overlay {
                Image(systemName: "arrow.trianglehead.clockwise")
                    .font(.system(size: diameter * 0.55, weight: .bold))
                    .foregroundStyle(Color.yapperOrange)
            }
            .frame(width: diameter, height: diameter)
            .allowsHitTesting(false)
    }
}

/// The part you can grab. Reports where the drag started and where it has got
/// to, in stage points, because a turn is an angle swept about a centre rather
/// than a distance travelled.
struct TurnPad: View {
    let onDrag: (_ start: CGPoint, _ current: CGPoint, _ ended: Bool) -> Void

    var body: some View {
        Color.clear
            .frame(width: 24, height: 24)
            .contentShape(Circle())
            .cursor(.crosshair)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { onDrag($0.startLocation, $0.location, false) }
                    .onEnded { onDrag($0.startLocation, $0.location, true) }
            )
    }
}

/// How far the rotate handle stands off the top edge of whatever it turns.
enum TurnHandle {
    static let reach = 22.0
}
