@preconcurrency import AppKit
import SwiftUI

/// The instruction box, with the caret and the arrow keys exposed.
///
/// SwiftUI's own text field can do neither, and a mention list needs both: where
/// the caret is decides which `@` is being typed, and Up, Down, Return, Tab and
/// Escape have to belong to the list while it is open rather than to the text.
///
/// It lives inside a scroller and is held to at least the scroller's height. A
/// bare `NSTextView` that is vertically resizable sizes its own frame down to
/// the text it holds, so in a box four lines tall only the first line was
/// actually the text view: clicking anywhere below it hit nothing at all, and
/// the box refused to take the caret unless you landed on the words themselves.
struct MentionTextView: NSViewRepresentable {
    /// A key the suggestion list might want before the text does.
    enum ListKey {
        case up
        case down
        case accept
        case dismiss
    }

    @Binding var text: String
    /// Where the caret is, so the caller can work out the mention around it.
    @Binding var caret: Int
    let placeholder: String
    /// Bumped by the card around the box to mean "somebody clicked me": the
    /// whole card is the target, not just the glyphs.
    var focusRequest = 0
    /// Handed each key the list might claim. Returning true swallows it.
    let onListKey: (ListKey) -> Bool
    /// Escape, when the list did not want it. Typing into a box is not a good
    /// enough reason for Escape to stop meaning "put this away".
    var onEscape: () -> Void = {}
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> MentionScrollView {
        let scrollView = MentionScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.verticalScrollElasticity = .none

        let textView = MentionNSTextView()
        textView.delegate = context.coordinator
        textView.string = text
        textView.font = .systemFont(ofSize: 13)
        textView.drawsBackground = false
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.autoresizingMask = [.width]
        textView.maxSize = NSSize(
            width: CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude
        )
        textView.textContainerInset = CGSize(width: 4, height: 6)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(
            width: 0,
            height: CGFloat.greatestFiniteMagnitude
        )

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: MentionScrollView, context: Context) {
        guard let textView = scrollView.documentView as? MentionNSTextView else { return }
        context.coordinator.parent = self
        textView.onListKey = onListKey
        textView.onEscape = onEscape
        textView.onSubmit = onSubmit
        textView.placeholderText = placeholder
        // Only write back when the model has moved on its own — accepting a
        // suggestion, say. Echoing every keystroke would fight the field.
        if textView.string != text {
            textView.string = text
            let target = min(max(0, caret), text.count)
            textView.setSelectedRange(NSRange(location: target, length: 0))
            textView.scrollRangeToVisible(textView.selectedRange())
        }
        if focusRequest != context.coordinator.lastFocusRequest {
            context.coordinator.lastFocusRequest = focusRequest
            // Deferred: the click that asked for this is still being handled,
            // and SwiftUI may take first responder back on the way out of it.
            //
            // Tried twice, because the request now also arrives from the panel
            // opening, and on that first pass the text view has been made but
            // not yet put in a window. A focus request with nowhere to send it
            // would be dropped, and ⌘K would land you in a box you still had to
            // click into.
            focus(textView, attemptsLeft: 6)
        }
        textView.needsDisplay = true
    }

    /// Puts the caret in the box, waiting for it to be in a window if it is
    /// not there yet. Gives up after a handful of turns rather than spinning:
    /// a text view that never joins a window is a bug elsewhere, and a retry
    /// loop is a poor place to find out about it.
    private func focus(_ textView: NSTextView, attemptsLeft: Int) {
        DispatchQueue.main.async {
            guard let window = textView.window else {
                guard attemptsLeft > 1 else { return }
                focus(textView, attemptsLeft: attemptsLeft - 1)
                return
            }
            window.makeFirstResponder(textView)
        }
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: MentionTextView
        var lastFocusRequest = 0

        init(_ parent: MentionTextView) {
            self.parent = parent
            lastFocusRequest = parent.focusRequest
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
            parent.caret = textView.selectedRange().location
            textView.needsDisplay = true
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            // Clicking or arrowing back into an earlier mention has to offer
            // that one, so the caret is tracked even when nothing was typed.
            parent.caret = textView.selectedRange().location
        }
    }
}

/// A scroller that keeps its text view at least as tall as itself.
///
/// This is the whole reason the box takes a click anywhere in it. The text view
/// grows past this on its own once there is enough text to need it, and the
/// scroller takes over from there.
final class MentionScrollView: NSScrollView {
    override func layout() {
        super.layout()
        guard let textView = documentView as? NSTextView else { return }
        let floor = contentSize.height
        if textView.minSize.height != floor {
            textView.minSize = NSSize(width: 0, height: floor)
        }
        if textView.frame.height < floor {
            textView.frame.size.height = floor
        }
    }
}

/// The text view itself: everything here is about letting the suggestion list
/// borrow the keyboard.
final class MentionNSTextView: NSTextView {
    var onListKey: ((MentionTextView.ListKey) -> Bool)?
    var onEscape: (() -> Void)?
    var onSubmit: (() -> Void)?
    var placeholderText = "" {
        didSet { needsDisplay = true }
    }

    override func keyDown(with event: NSEvent) {
        let key: MentionTextView.ListKey? = switch event.keyCode {
        case 126: .up
        case 125: .down
        case 36, 48: .accept // Return and Tab both take the highlighted name
        case 53: .dismiss
        default: nil
        }
        // The list gets first refusal; anything it does not want is typing.
        if let key, onListKey?(key) == true { return }
        // Except Escape, which the list only wanted if it was open. Otherwise
        // it belongs to whatever is holding the box.
        if key == .dismiss {
            window?.makeFirstResponder(nil)
            onEscape?()
            return
        }
        // Return sends the instruction, Shift-Return starts a new line.
        if event.keyCode == 36, !event.modifierFlags.contains(.shift) {
            onSubmit?()
            return
        }
        super.keyDown(with: event)
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard string.isEmpty, !placeholderText.isEmpty else { return }
        // Drawn into the box's own width so a long example wraps instead of
        // running off the end of it.
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byWordWrapping
        NSAttributedString(
            string: placeholderText,
            attributes: [
                .font: font ?? .systemFont(ofSize: 13),
                .foregroundColor: NSColor.secondaryLabelColor,
                .paragraphStyle: paragraph,
            ]
        )
        .draw(
            with: NSRect(
                x: textContainerInset.width,
                y: textContainerInset.height,
                width: max(0, bounds.width - textContainerInset.width * 2),
                height: max(0, bounds.height - textContainerInset.height * 2)
            ),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        )
    }
}
