import AppKit

/// The composer's text view: plain text, ⌘Return to bank, and Backspace that
/// takes a whole link in two presses instead of nibbling it apart.
final class ComposerNSTextView: NSTextView {
    var onSubmit: (() -> Void)?
    /// Returns true when the press was spent selecting a link.
    var onBackspace: (() -> Bool)?
    var onEscape: (() -> Void)?

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if window?.firstResponder === self, isSubmit(event) {
            onSubmit?()
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    override func keyDown(with event: NSEvent) {
        if isSubmit(event) {
            onSubmit?()
            return
        }
        super.keyDown(with: event)
    }

    override func deleteBackward(_ sender: Any?) {
        if onBackspace?() == true { return }
        super.deleteBackward(sender)
    }

    /// Copying a chip copies its URL, not the attachment character.
    override func writeSelection(to pboard: NSPasteboard, types: [NSPasteboard.PasteboardType]) -> Bool {
        guard let storage = textStorage else { return false }
        pboard.clearContents()
        return pboard.setString(ComposerChips.plain(from: storage.attributedSubstring(from: selectedRange())), forType: .string)
    }

    override func cancelOperation(_ sender: Any?) {
        onEscape?()
    }

    private func isSubmit(_ event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        return flags.contains(.command) && (event.keyCode == 36 || event.keyCode == 76)
    }
}
