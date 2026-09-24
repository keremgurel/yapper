import AppKit
import SwiftUI

/// A long-form script or an article body, typed as plain text but shown with
/// its structure: a `## ` line reads as a heading (the marker kept, quietly,
/// so it stays editable) and a `[B-ROLL: ...]` or `[ON SCREEN: ...]` line
/// reads as a note, smaller and muted. Grows with its content like the other
/// canvas editors instead of scrolling inside itself.
struct IdeaCanvasStyledScriptView: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var minHeight: CGFloat = 420

    static let inset = NSSize(width: 0, height: 4)

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSTextView {
        let view = NSTextView()
        view.isRichText = false
        view.importsGraphics = false
        view.allowsUndo = true
        view.drawsBackground = false
        view.isAutomaticQuoteSubstitutionEnabled = false
        view.isAutomaticDashSubstitutionEnabled = false
        view.textContainerInset = Self.inset
        view.textContainer?.lineFragmentPadding = 0
        view.textContainer?.widthTracksTextView = true
        view.isVerticallyResizable = false
        view.isHorizontallyResizable = false
        view.delegate = context.coordinator
        view.string = text
        context.coordinator.restyle(view)
        return view
    }

    func updateNSView(_ view: NSTextView, context: Context) {
        context.coordinator.parent = self
        guard view.string != text else { return }
        let selection = view.selectedRange()
        view.string = text
        context.coordinator.restyle(view)
        view.setSelectedRange(NSRange(location: min(selection.location, (text as NSString).length), length: 0))
    }

    func sizeThatFits(_ proposal: ProposedViewSize, nsView: NSTextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0,
              let container = nsView.textContainer, let layout = nsView.layoutManager else { return nil }
        container.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        layout.ensureLayout(for: container)
        let height = ceil(layout.usedRect(for: container).height + Self.inset.height * 2)
        return CGSize(width: width, height: max(height, minHeight))
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: IdeaCanvasStyledScriptView

        init(_ parent: IdeaCanvasStyledScriptView) { self.parent = parent }

        func textDidChange(_ notification: Notification) {
            guard let view = notification.object as? NSTextView else { return }
            restyle(view)
            parent.text = view.string
        }

        /// Attributes only, never the characters, so undo and the caret are
        /// left alone.
        func restyle(_ view: NSTextView) {
            guard let storage = view.textStorage else { return }
            let ns = storage.string as NSString
            storage.beginEditing()
            var location = 0
            while location < ns.length {
                let line = ns.lineRange(for: NSRange(location: location, length: 0))
                storage.setAttributes(Style.attributes(for: ns.substring(with: line)), range: line)
                if let marker = Style.markerRange(in: ns.substring(with: line)) {
                    storage.addAttributes(Style.marker, range: NSRange(location: line.location + marker.location, length: marker.length))
                }
                location = NSMaxRange(line)
            }
            storage.endEditing()
            view.typingAttributes = Style.body
            view.needsDisplay = true
            view.invalidateIntrinsicContentSize()
        }
    }

    /// How each kind of line looks.
    enum Style {
        static var body: [NSAttributedString.Key: Any] { [
            .font: NSFont.systemFont(ofSize: 16),
            .foregroundColor: NSColor.labelColor,
            .paragraphStyle: paragraph(lineSpacing: 9, before: 0),
        ] }

        static var heading: [NSAttributedString.Key: Any] { [
            .font: NSFont.systemFont(ofSize: 19, weight: .semibold),
            .foregroundColor: NSColor.labelColor,
            .paragraphStyle: paragraph(lineSpacing: 4, before: 22, after: 6),
        ] }

        static var note: [NSAttributedString.Key: Any] { [
            .font: NSFont.systemFont(ofSize: 13, weight: .medium),
            .foregroundColor: NSColor.secondaryLabelColor,
            .paragraphStyle: paragraph(lineSpacing: 4, before: 4),
        ] }

        /// The `## ` in front of a heading: there, but out of the way.
        static var marker: [NSAttributedString.Key: Any] { [
            .foregroundColor: NSColor.tertiaryLabelColor,
            .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular),
        ] }

        static func attributes(for line: String) -> [NSAttributedString.Key: Any] {
            if IdeaCanvasChapters.title(of: line) != nil { return heading }
            if IdeaCanvasChapters.isNote(line) { return note }
            return body
        }

        static func markerRange(in line: String) -> NSRange? {
            guard IdeaCanvasChapters.title(of: line) != nil else { return nil }
            let leading = line.prefix { $0 == " " || $0 == "\t" }.utf16.count
            return NSRange(location: leading, length: 2)
        }

        private static func paragraph(lineSpacing: CGFloat, before: CGFloat, after: CGFloat = 0) -> NSParagraphStyle {
            let style = NSMutableParagraphStyle()
            style.lineSpacing = lineSpacing
            style.paragraphSpacingBefore = before
            style.paragraphSpacing = after
            return style
        }
    }
}
