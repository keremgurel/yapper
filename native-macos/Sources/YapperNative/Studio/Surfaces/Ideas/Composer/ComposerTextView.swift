import AppKit
import SwiftUI

/// The composer's writing surface: an AppKit text view, because links are
/// painted as links where they were typed, and Instagram, TikTok and YouTube
/// links turn into an inline mark and name, which a SwiftUI field cannot do.
/// Reports its content height so the card can grow with what is written.
struct ComposerTextView: NSViewRepresentable {
    @ObservedObject var draft: CaptureDraft
    var fontSize: CGFloat
    var editable: Bool
    var onSubmit: () -> Void
    var onEscape: () -> Void
    @Binding var contentHeight: CGFloat

    static let inset = NSSize(width: 2, height: 4)

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.borderType = .noBorder

        let text = ComposerNSTextView(frame: NSRect(origin: .zero, size: scroll.contentSize))
        text.isRichText = false
        text.importsGraphics = false
        text.allowsUndo = true
        text.drawsBackground = false
        text.isAutomaticQuoteSubstitutionEnabled = false
        text.isAutomaticDashSubstitutionEnabled = false
        // Inline predictions sit in the text as marked text; with links
        // turning into chips under the caret they only get in the way.
        text.inlinePredictionType = .no
        text.textContainerInset = Self.inset
        text.isVerticallyResizable = true
        text.isHorizontallyResizable = false
        text.autoresizingMask = [.width]
        text.minSize = .zero
        text.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        text.textContainer?.widthTracksTextView = true
        text.postsFrameChangedNotifications = true
        text.delegate = context.coordinator
        scroll.documentView = text

        let coordinator = context.coordinator
        coordinator.textView = text
        coordinator.applyExternalText()
        text.onSubmit = { coordinator.parent.onSubmit() }
        text.onBackspace = { coordinator.backspace() }
        text.onEscape = { coordinator.parent.onEscape() }
        NotificationCenter.default.addObserver(
            coordinator, selector: #selector(Coordinator.frameChanged), name: NSView.frameDidChangeNotification, object: text
        )
        DispatchQueue.main.async { coordinator.focus() }
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        let coordinator = context.coordinator
        let fontChanged = coordinator.parent.fontSize != fontSize
        coordinator.parent = self
        guard let text = coordinator.textView else { return }
        text.isEditable = editable
        if let storage = text.textStorage, ComposerChips.plain(from: storage) != draft.text || fontChanged {
            coordinator.applyExternalText()
        }
    }

    static func dismantleNSView(_ scroll: NSScrollView, coordinator: Coordinator) {
        NotificationCenter.default.removeObserver(coordinator)
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ComposerTextView
        weak var textView: ComposerNSTextView?
        private var applying = false

        init(_ parent: ComposerTextView) { self.parent = parent }

        /// Set when the last edit put in more than one character at once,
        /// so a pasted link turns into a chip straight away.
        private var lastInsertLength = 0

        func focus() {
            guard let text = textView, let storage = text.textStorage else { return }
            text.window?.makeFirstResponder(text)
            applying = true
            text.setSelectedRange(displayRange(clamped(parent.draft.selection, end: true), in: storage))
            applying = false
            measure()
        }

        /// Rebuilds the display from the draft: used on open, when something
        /// else changes the draft (sending it, dictation), and on a font change.
        func applyExternalText() {
            guard let text = textView, let storage = text.textStorage else { return }
            applying = true
            let display = NSMutableAttributedString(string: parent.draft.text)
            for (range, platform) in ComposerChips.pending(in: display.string, caret: nil, pasted: true).reversed() {
                display.replaceCharacters(in: range, with: chip(for: (display.string as NSString).substring(with: range), platform: platform))
            }
            storage.setAttributedString(display)
            restyle()
            text.setSelectedRange(displayRange(clamped(parent.draft.selection, end: true), in: storage))
            applying = false
            measure()
        }

        func textView(_ textView: NSTextView, shouldChangeTextIn range: NSRange, replacementString: String?) -> Bool {
            lastInsertLength = (replacementString as NSString?)?.length ?? 0
            return true
        }

        func textDidChange(_ notification: Notification) {
            // Marked text (an input method mid-composition) is not the
            // creator's text yet; it arrives as another change when committed.
            guard let text = textView, let storage = text.textStorage, !applying, !text.hasMarkedText() else { return }
            chipPendingLinks(pasted: lastInsertLength > 1)
            lastInsertLength = 0
            restyle()
            parent.draft.text = ComposerChips.plain(from: storage)
            measure()
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard let text = textView, let storage = text.textStorage, !applying else { return }
            let range = text.selectedRange()
            let start = ComposerChips.plainOffset(range.location, in: storage)
            let end = ComposerChips.plainOffset(range.location + range.length, in: storage)
            parent.draft.selection = NSRange(location: start, length: end - start)
        }

        /// Turns finished platform links into chips as an ordinary, undoable
        /// edit, keeping the caret where it was relative to the text.
        private func chipPendingLinks(pasted: Bool) {
            guard let text = textView, let storage = text.textStorage else { return }
            var caret = text.selectedRange().location
            let pending = ComposerChips.pending(in: storage.string, caret: caret, pasted: pasted)
            guard !pending.isEmpty else { return }
            applying = true
            for (range, platform) in pending.reversed() {
                let url = (storage.string as NSString).substring(with: range)
                guard text.shouldChangeText(in: range, replacementString: "\u{FFFC}") else { continue }
                storage.replaceCharacters(in: range, with: chip(for: url, platform: platform))
                text.didChangeText()
                if caret >= range.location + range.length { caret -= range.length - 1 }
            }
            text.setSelectedRange(NSRange(location: min(caret, storage.length), length: 0))
            applying = false
        }

        private func chip(for url: String, platform: LinkPlatform) -> NSAttributedString {
            let dark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSAttributedString(attachment: ComposerLinkAttachment(url: url, platform: platform, fontSize: parent.fontSize, dark: dark))
        }

        private func displayRange(_ plain: NSRange, in storage: NSAttributedString) -> NSRange {
            let start = ComposerChips.displayOffset(plain.location, in: storage)
            let end = ComposerChips.displayOffset(plain.location + plain.length, in: storage)
            return NSRange(location: start, length: max(end - start, 0))
        }

        /// First press against a link selects the whole link; the second
        /// deletes the selection like any other.
        func backspace() -> Bool {
            guard let text = textView else { return false }
            let selection = text.selectedRange()
            guard selection.length == 0, let link = CaptureText.linkEnding(at: selection.location, in: text.string) else { return false }
            text.setSelectedRange(link)
            return true
        }

        @objc func frameChanged() { measure() }

        /// Base font and color everywhere, link color on links still shown
        /// as text. Adds rather than sets attributes, so chips survive.
        func restyle() {
            guard let text = textView, let storage = text.textStorage else { return }
            let paragraph = NSMutableParagraphStyle()
            paragraph.lineSpacing = 3
            let base: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: parent.fontSize),
                .foregroundColor: NSColor.labelColor,
                .paragraphStyle: paragraph,
            ]
            let whole = NSRange(location: 0, length: storage.length)
            storage.beginEditing()
            storage.addAttributes(base, range: whole)
            storage.removeAttribute(.underlineStyle, range: whole)
            for range in CaptureText.linkRanges(in: storage.string) {
                storage.addAttributes([.foregroundColor: NSColor.linkColor, .underlineStyle: NSUnderlineStyle.single.rawValue], range: range)
            }
            storage.endEditing()
            text.typingAttributes = base
        }

        func measure() {
            guard let text = textView, let layout = text.layoutManager, let container = text.textContainer else { return }
            layout.ensureLayout(for: container)
            let height = ceil(layout.usedRect(for: container).height + text.textContainerInset.height * 2)
            guard abs(height - parent.contentHeight) > 0.5 else { return }
            DispatchQueue.main.async { [weak self] in self?.parent.contentHeight = height }
        }

        private func clamped(_ range: NSRange, end: Bool) -> NSRange {
            let length = (parent.draft.text as NSString).length
            guard range.location != NSNotFound, range.location <= length else {
                return NSRange(location: end ? length : 0, length: 0)
            }
            return NSRange(location: range.location, length: min(range.length, length - range.location))
        }
    }
}
