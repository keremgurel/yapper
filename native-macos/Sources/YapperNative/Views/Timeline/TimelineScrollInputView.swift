@preconcurrency import AppKit
import SwiftUI

/// Turns scroll-wheel and trackpad input over the timeline into zoom and
/// horizontal pan. Pinch is handled by a gesture on the viewport instead,
/// because `.magnify` events never reach a local monitor here.
///
/// A local `NSEvent` monitor is used instead of an `NSView.scrollWheel`
/// override because the monitor sees each event before it reaches the view
/// hierarchy, so Command-scroll can be claimed for zoom before any scroll view
/// consumes it. The backing view stays out of hit testing, which leaves clicks,
/// drags, and trim handles landing on the clips underneath.
struct TimelineScrollInputView: NSViewRepresentable {
    let layout: TimelineViewportLayout
    /// Distance from this view's leading edge to the scrollable area, i.e. the
    /// width of the fixed track-header column.
    let viewportOriginX: Double
    /// `(factor, anchorX in viewport coordinates)`.
    let onZoom: (Double, Double) -> Void
    /// Signed change to apply to the scroll offset.
    let onPan: (Double) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(layout: layout, viewportOriginX: viewportOriginX, onZoom: onZoom, onPan: onPan)
    }

    func makeNSView(context: Context) -> PassthroughView {
        let view = PassthroughView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: PassthroughView, context: Context) {
        context.coordinator.view = nsView
        context.coordinator.layout = layout
        context.coordinator.viewportOriginX = viewportOriginX
        context.coordinator.onZoom = onZoom
        context.coordinator.onPan = onPan
    }

    static func dismantleNSView(_ nsView: PassthroughView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class PassthroughView: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }

    @MainActor
    final class Coordinator {
        weak var view: PassthroughView?
        var layout: TimelineViewportLayout
        var viewportOriginX: Double
        var onZoom: (Double, Double) -> Void
        var onPan: (Double) -> Void
        private var monitor: Any?
        private var router = TimelineScrollRouter()

        init(
            layout: TimelineViewportLayout,
            viewportOriginX: Double,
            onZoom: @escaping (Double, Double) -> Void,
            onPan: @escaping (Double) -> Void
        ) {
            self.layout = layout
            self.viewportOriginX = viewportOriginX
            self.onZoom = onZoom
            self.onPan = onPan
        }

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
                self?.handle(event) ?? event
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        private func handle(_ event: NSEvent) -> NSEvent? {
            guard
                event.type == .scrollWheel,
                let view,
                let window = view.window,
                event.window === window,
                view.convert(view.bounds, to: nil).contains(event.locationInWindow)
            else { return event }

            let anchorX = min(
                layout.viewportWidth,
                max(0, Double(view.convert(event.locationInWindow, from: nil).x) - viewportOriginX)
            )

            switch router.route(input(from: event)) {
            case .zoom(let factor):
                onZoom(factor, anchorX)
                return nil
            case .pan(let delta):
                onPan(delta)
                return nil
            case .swallow:
                return nil
            case .handOff:
                return event
            }
        }

        private func input(from event: NSEvent) -> TimelineScrollRouter.Input {
            TimelineScrollRouter.Input(
                deltaX: Double(event.scrollingDeltaX),
                deltaY: Double(event.scrollingDeltaY),
                hasPreciseDeltas: event.hasPreciseScrollingDeltas,
                // Some devices drop the modifier from the event itself part-way
                // through a gesture, so the live keyboard state is consulted too.
                commandHeld: event.modifierFlags
                    .intersection(.deviceIndependentFlagsMask)
                    .contains(.command)
                    || NSEvent.modifierFlags.contains(.command),
                startsGesture: event.phase.contains(.began) || event.phase.contains(.mayBegin),
                // `.ended` is deliberately not an ending: the momentum glide that
                // follows it still belongs to the same gesture.
                endsGesture: event.phase.contains(.cancelled)
                    || event.momentumPhase.contains(.ended),
                isContinuous: event.phase != [] || event.momentumPhase != []
            )
        }
    }
}
