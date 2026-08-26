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
    /// P: present the existing preview by itself.
    case togglePreviewFullScreen
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

        /// The key press already turned into a command.
        ///
        /// One press, one command. AppKit hands the same physical key event to
        /// a local monitor more than once: measured on a real Backspace, the
        /// identical event (same timestamp, same monitor, same coordinator)
        /// arrived twice. The first pass deleted the selected clip, and the
        /// second found the selection now empty and fell through to whatever
        /// the playhead had rippled onto, which is how deleting one clip took
        /// the next one with it. Space had the same shape: play, then pause,
        /// then nothing playing.
        ///
        /// A press is identified by its timestamp, which the window server
        /// stamps once per event, so a repeat delivery of one press is
        /// recognisable while two real presses never collide. Shared across
        /// coordinators so a second monitor could not reintroduce the double
        /// either.
        private static var claimedPress: (timestamp: TimeInterval, keyCode: UInt16)?

        static func claim(_ event: NSEvent) -> Bool {
            if let claimed = claimedPress,
               claimed.timestamp == event.timestamp,
               claimed.keyCode == event.keyCode
            {
                return false
            }
            claimedPress = (event.timestamp, event.keyCode)
            return true
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

            guard let command = Self.command(
                keyCode: event.keyCode,
                characters: event.charactersIgnoringModifiers
            ) else { return event }
            guard Self.claim(event) else { return nil }
            onCommand(command)
            return nil
        }

        static func command(keyCode: UInt16, characters: String?) -> TimelineKeyCommand? {
            switch keyCode {
            case 49: return .togglePlayback
            case 53: return .cancelDrag
            case 51, 117: return .delete
            case 123: return .stepBack
            case 124: return .stepForward
            default: break
            }
            switch characters?.lowercased() {
            case "s": return .split
            case "p": return .togglePreviewFullScreen
            case "[": return .trimLeading
            case "]": return .trimTrailing
            default: return nil
            }
        }
    }
}
