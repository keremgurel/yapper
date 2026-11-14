import SwiftUI

/// The track and handle of a volume control, and nothing else.
///
/// Drawn and dragged by hand rather than with `Slider`. On macOS the system
/// slider reports the end of an edit in the middle of a drag as well as at the
/// end of it, and each of those was a commit: an undo step, a save and a
/// rebuilt mix halfway through the gesture, after which the handle snapped to
/// the saved value and back. Here the gesture has one end, and it is the one
/// the pointer makes.
struct VolumeFader: View {
    let value: Double
    let maximum: Double
    let accessibilityName: String
    let onDrag: (Double) -> Void
    let onRelease: () -> Void

    @State private var hovering = false
    @GestureState private var pressed = false
    @FocusState private var focused: Bool

    private let handle: CGFloat = 14
    private let trackHeight: CGFloat = 4

    var body: some View {
        GeometryReader { proxy in
            let travel = max(1, proxy.size.width - handle)
            let fraction = CGFloat(min(1, max(0, value / maximum)))
            let unity = CGFloat(AudioLevel.unity / maximum)

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.studioLineStrong)
                    .frame(height: trackHeight)
                    .padding(.horizontal, handle / 2)

                Capsule()
                    .fill(Color.studioAccent)
                    .frame(width: max(trackHeight, travel * fraction), height: trackHeight)
                    .offset(x: handle / 2)

                // 100%, as recorded. A notch to aim at, not a stop.
                Rectangle()
                    .fill(Color.secondary.opacity(0.45))
                    .frame(width: 1, height: 8)
                    .offset(x: handle / 2 + travel * unity - 0.5)

                Circle()
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.35), radius: 1.5, y: 0.5)
                    .frame(width: handle, height: handle)
                    .scaleEffect(pressed ? 1.12 : hovering ? 1.06 : 1)
                    .animation(.easeOut(duration: 0.12), value: pressed)
                    .animation(.easeOut(duration: 0.12), value: hovering)
                    .offset(x: travel * fraction)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .updating($pressed) { _, state, _ in state = true }
                    .onChanged { drag in
                        let x = min(travel, max(0, drag.location.x - handle / 2))
                        onDrag(Double(x / travel) * maximum)
                    }
                    .onEnded { _ in onRelease() }
            )
            .onHover { hovering = $0 }
        }
        .frame(height: 22)
        .frame(minWidth: 80)
        // Reachable from the keyboard too: arrows step by five percent, one
        // commit per press, the same as a drag.
        .focusable()
        .focused($focused)
        .focusEffectDisabled()
        .overlay {
            Capsule()
                .strokeBorder(Color.studioAccent.opacity(focused ? 0.7 : 0), lineWidth: 1.5)
                .padding(-2)
        }
        .onMoveCommand { direction in
            switch direction {
            case .right, .up: step(by: 0.05)
            case .left, .down: step(by: -0.05)
            @unknown default: return
            }
        }
        .accessibilityElement()
        .accessibilityLabel(accessibilityName)
        .accessibilityValue("\(AudioLevel.percent(value)) percent")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: step(by: 0.05)
            case .decrement: step(by: -0.05)
            @unknown default: return
            }
        }
    }

    private func step(by amount: Double) {
        onDrag(min(maximum, max(AudioLevel.minimum, value + amount)))
        onRelease()
    }
}
