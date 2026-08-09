@preconcurrency import AppKit
import SwiftUI

/// Unmodified keys the editor claims while the timeline is on screen.
enum TimelineKeyCommand {
    case togglePlayback
    case split
    case delete
    case trimLeading
    case trimTrailing
    /// One frame back or forward, for landing exactly on a cut after clicking
    /// roughly where it is.
    case stepBack
    case stepForward
    /// Escape: put back whatever is being dragged, without letting go first.
    case cancelDrag
}

/// Delivers unmodified editor keys through a local `NSEvent` monitor.
///
/// The main menu carries the same shortcuts for discoverability, but AppKit
/// hands an unmodified key equivalent to the focused view before the menu gets
/// a look at it, so Space reached the scroll views instead of the transport.
/// Watching key-down here is what actually makes these keys fire.
struct TimelineKeyCommandView: NSViewRepresentable {
    let onCommand: (TimelineKeyCommand) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCommand: onCommand)
    }

    func makeNSView(context: Context) -> PassthroughView {
        let view = PassthroughView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: PassthroughView, context: Context) {
        context.coordinator.view = nsView
        context.coordinator.onCommand = onCommand
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
        var onCommand: (TimelineKeyCommand) -> Void
        private var monitor: Any?

        init(onCommand: @escaping (TimelineKeyCommand) -> Void) {
            self.onCommand = onCommand
        }

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                self?.handle(event) ?? event
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        private func handle(_ event: NSEvent) -> NSEvent? {
            guard let view, let window = view.window, event.window === window else { return event }
            // Typing a space in the transcript or a caption field must stay a
            // space, so a field being edited is left alone. A selectable label
            // is not being typed into and must not swallow the transport.
            if let text = window.firstResponder as? NSTextView, text.isEditable {
                return event
            }
            if window.firstResponder is NSTextField { return event }
            // Holding a key must not toggle playback over and over.
            if event.isARepeat { return event }
            let disallowedModifiers: NSEvent.ModifierFlags = [.command, .control, .option, .shift]
            guard event.modifierFlags.intersection(disallowedModifiers).isEmpty else { return event }

            guard let command = command(for: event) else { return event }
            onCommand(command)
            return nil
        }

        private func command(for event: NSEvent) -> TimelineKeyCommand? {
            switch event.keyCode {
            case 49: return .togglePlayback
            case 53: return .cancelDrag
            case 51, 117: return .delete
            case 123: return .stepBack
            case 124: return .stepForward
            default: break
            }
            switch event.charactersIgnoringModifiers?.lowercased() {
            case "s": return .split
            case "[": return .trimLeading
            case "]": return .trimTrailing
            default: return nil
            }
        }
    }
}
