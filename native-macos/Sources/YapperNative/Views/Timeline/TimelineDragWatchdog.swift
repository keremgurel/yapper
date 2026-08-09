@preconcurrency import AppKit
import SwiftUI

/// Puts the timeline back together if a drag ever ends without saying so.
///
/// SwiftUI can drop a gesture's `onEnded` — a view rebuilt mid-drag never hears
/// the mouse come up — and when that happened the track was left holding an open
/// drop gap with no way back except reopening the project. The layout no longer
/// rebuilds anything mid-drag, so this should never fire; it exists so that
/// "should never" cannot cost the creator their session.
///
/// It waits a beat after the button comes up, which is long enough for a healthy
/// drag to have finished and cleaned up after itself.
struct TimelineDragWatchdog: NSViewRepresentable {
    let onStrandedDrag: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onStrandedDrag: onStrandedDrag)
    }

    func makeNSView(context: Context) -> NSView {
        let view = PassthroughView()
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        context.coordinator.onStrandedDrag = onStrandedDrag
    }

    static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class PassthroughView: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }

    @MainActor
    final class Coordinator {
        var onStrandedDrag: () -> Void
        private var monitor: Any?
        private var check: Task<Void, Never>?

        init(onStrandedDrag: @escaping () -> Void) {
            self.onStrandedDrag = onStrandedDrag
        }

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseUp) { [weak self] event in
                self?.scheduleCheck()
                return event
            }
        }

        func uninstall() {
            check?.cancel()
            check = nil
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        private func scheduleCheck() {
            check?.cancel()
            check = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                self?.onStrandedDrag()
            }
        }
    }
}
