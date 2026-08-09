@preconcurrency import AppKit
import SwiftUI

/// Ends text editing as soon as a click lands anywhere outside the field being
/// typed in.
///
/// AppKit only moves the keyboard when a click lands on something that asks for
/// it, and SwiftUI's own views never do. So after editing a caption and clicking
/// away, the field editor still held the keyboard: Space went on typing spaces
/// into the caption instead of playing the video, with nothing on screen to say
/// why.
///
/// Watching mouse-down here rather than adding a dismiss gesture to every panel
/// means one rule covers the whole editor, including the parts that have their
/// own gestures already.
struct EndEditingOnOutsideClickView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> PassthroughView {
        let view = PassthroughView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: PassthroughView, context: Context) {
        context.coordinator.view = nsView
    }

    static func dismantleNSView(_ nsView: PassthroughView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    /// Invisible to the mouse: this view exists to listen, never to catch.
    final class PassthroughView: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }

    @MainActor
    final class Coordinator {
        weak var view: PassthroughView?
        private var monitor: Any?

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] event in
                self?.handle(event)
                return event
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        /// The event is always passed on: the click still does whatever it was
        /// going to do, it just stops leaving the keyboard behind.
        private func handle(_ event: NSEvent) {
            guard
                let window = view?.window,
                event.window === window,
                let editor = window.firstResponder as? NSTextView,
                // Editable, not merely selectable: the transcript is a wall of
                // selectable text and clicking off it was never editing.
                editor.isEditable
            else { return }

            let point = box(for: editor).convert(event.locationInWindow, from: nil)
            guard !box(for: editor).bounds.contains(point) else { return }

            // Ends editing the way Return does: the field commits what was
            // typed, and its delegate hears about it.
            window.makeFirstResponder(nil)
        }

        /// What counts as "inside" for the thing currently being typed into.
        ///
        /// A caption is an `NSTextField`, which borrows the window's shared
        /// field editor and is that editor's delegate, so the control is the
        /// box. Chirpy's instruction box is a text view of our own, which is
        /// itself the box — and it used to be missed entirely, because the only
        /// case handled here was the field editor. That is why clicking away
        /// from Chirpy left the keyboard behind and Space went on typing spaces
        /// instead of playing the video.
        private func box(for editor: NSTextView) -> NSView {
            if editor.isFieldEditor {
                return (editor.delegate as? NSView) ?? editor
            }
            // The scroller around it counts too: its bar is part of the box.
            return editor.enclosingScrollView ?? editor
        }
    }
}
