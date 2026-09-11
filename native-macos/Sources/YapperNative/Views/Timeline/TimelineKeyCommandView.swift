@preconcurrency import AppKit
import SwiftUI
import WebKit

@MainActor
protocol EditorKeyboardCommandScope: AnyObject {
    var editorKeyboardCommandsEnabled: Bool { get }
}

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
                guard let self else { return event }
                return self.handle(event)
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        func handle(_ event: NSEvent) -> NSEvent? {
            guard let view, let window = view.window, event.window === window else { return event }
            // The editor stays mounted behind the other Studio destinations,
            // so this monitor is alive while a web page is on screen. A space
            // typed into a Brain field there is a space, not play; a letter is
            // a letter, not a panel toggle. Anything typed into a web view, or
            // while this view is not the one being looked at, is left alone.
            guard Self.isEditorActive(view) else { return event }
            if Self.isInsideWebView(window.firstResponder) { return event }
            // Typing a space in the transcript or a caption field must stay a
            // space, so a field being edited is left alone. A selectable label
            // is not being typed into and must not swallow the transport.
            if let text = window.firstResponder as? NSTextView, text.isEditable {
                return event
            }
            if let field = window.firstResponder as? NSTextField, field.isEditable { return event }
            guard let command = Self.command(for: event) else { return event }
            // Consume repeats too: passing Space to a focused button can
            // toggle playback a second time through that control's own action.
            if event.isARepeat { return nil }
            guard Self.claim(event) else { return nil }
            onCommand(command)
            return nil
        }

        /// The listener is an invisible background view and can have an empty
        /// drawing rect even while its editor is active. Ask the persistent
        /// host, which already owns navigation/visibility, rather than using
        /// the listener's incidental SwiftUI layout as an input permission.
        static func isEditorActive(_ view: NSView) -> Bool {
            var ancestor: NSView? = view
            while let current = ancestor {
                if let host = current as? any EditorKeyboardCommandScope {
                    return host.editorKeyboardCommandsEnabled
                }
                ancestor = current.superview
            }
            // Standalone editor previews have no persistent shell host.
            return !view.isHiddenOrHasHiddenAncestor &&
                !(view.superview?.visibleRect.isEmpty ?? true)
        }

        static func command(for event: NSEvent) -> TimelineKeyCommand? {
            let modifiers = event.modifierFlags
            guard modifiers.intersection([.command, .control]).isEmpty else { return nil }
            // On several layouts [ and ] need Option or Shift. Honor the
            // character actually produced, without stealing Option-letter
            // combinations or shortcuts such as Command-[.
            if event.characters == "[" { return .trimLeading }
            if event.characters == "]" { return .trimTrailing }
            guard modifiers.intersection([.option, .shift]).isEmpty else { return nil }
            return command(keyCode: event.keyCode, characters: event.charactersIgnoringModifiers)
        }

        /// True when keystrokes are going to a web page: the Studio surfaces
        /// the shell hosts in a `WKWebView`, whose fields are not AppKit text
        /// views and so would not be recognised by the checks above.
        static func isInsideWebView(_ responder: NSResponder?) -> Bool {
            var current: NSResponder? = responder
            while let candidate = current {
                if let web = candidate as? WKWebView {
                    // Authentication keeps a web view parked offscreen. It
                    // can retain first responder after navigation, but must
                    // not capture the visible native editor's shortcuts.
                    guard let window = web.window, let content = window.contentView else { return false }
                    return !web.isHiddenOrHasHiddenAncestor &&
                        web.convert(web.bounds, to: content).intersects(content.bounds)
                }
                current = candidate.nextResponder
            }
            return false
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
