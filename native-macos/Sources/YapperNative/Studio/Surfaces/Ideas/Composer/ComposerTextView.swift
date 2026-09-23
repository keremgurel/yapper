import AppKit
import SwiftUI

/// The composer's writing surface: an AppKit text view, because links are
/// painted as links where they were typed, which a SwiftUI field cannot do.
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
        text.textContainerInset = Self.inset
        text.isVerticallyResizable = true
        text.isHorizontallyResizable = false
        text.autoresizingMask = [.width]
        text.minSize = .zero
        text.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        text.textContainer?.widthTracksTextView = true
        text.postsFrameChangedNotifications = true
        text.delegate = context.coordinator
        text.string = draft.text
        scroll.documentView = text

        let coordinator = context.coordinator
        coordinator.textView = text
        coordinator.restyle()
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
        if text.string != draft.text {
            coordinator.applyExternalText()
        } else if fontChanged {
            coordinator.restyle()
            coordinator.measure()
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

        func focus() {
            guard let text = textView else { return }
            text.window?.makeFirstResponder(text)
            applying = true
            text.setSelectedRange(clamped(parent.draft.selection, end: true))
            applying = false
            measure()
        }

        func applyExternalText() {
            guard let text = textView else { return }
            applying = true
            text.string = parent.draft.text
            restyle()
            text.setSelectedRange(clamped(parent.draft.selection, end: true))
            applying = false
            measure()
        }

        func textDidChange(_ notification: Notification) {
            guard let text = textView, !applying else { return }
            parent.draft.text = text.string
            restyle()
            measure()
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            guard let text = textView, !applying else { return }
            parent.draft.selection = text.selectedRange()
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

        func restyle() {
            guard let text = textView, let storage = text.textStorage else { return }
            let paragraph = NSMutableParagraphStyle()
            paragraph.lineSpacing = 3
            let base: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: parent.fontSize),
                .foregroundColor: NSColor.labelColor,
                .paragraphStyle: paragraph,
            ]
            storage.beginEditing()
            storage.setAttributes(base, range: NSRange(location: 0, length: storage.length))
            for range in CaptureText.linkRanges(in: text.string) {
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
