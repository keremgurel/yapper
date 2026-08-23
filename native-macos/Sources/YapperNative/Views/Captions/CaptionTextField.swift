import AppKit
import SwiftUI

/// A caption row's editable text, with the keyboard behaviour that makes a
/// caption list feel like a document rather than a stack of form fields.
///
/// This wraps `NSTextField` because all three gestures need the caret, which
/// SwiftUI's `TextField` will not surrender: Return splits at the caret's word,
/// Backspace at the very start merges the row upward, and the arrow keys walk
/// between rows.
struct CaptionTextField: NSViewRepresentable {
    @Binding var text: String
    var textCase: TextCasing
    var isFocused: Bool
    var onFocus: () -> Void
    /// Editing this row stopped, whether by clicking away, Escape, or Tab.
    /// Without it the row would keep claiming the caret and take the keyboard
    /// straight back on the next redraw.
    var onEndEditing: (String) -> Void
    /// Return was pressed with `wordsBefore` whole words ahead of the caret.
    var onSplit: (Int) -> Void
    /// Return with nothing left to split off: a new card after this one.
    var onAddAfter: () -> Void = {}
    /// Backspace was pressed with the caret at the very start of the row.
    var onMergeUp: () -> Void
    /// Up (-1) or Down (+1) was pressed; move editing to the neighbouring row.
    var onStep: (Int) -> Void

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField(string: textCase.apply(to: text))
        field.delegate = context.coordinator
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.font = .systemFont(ofSize: 12)
        field.lineBreakMode = .byTruncatingTail
        field.cell?.usesSingleLineMode = true
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        context.coordinator.parent = self
        let isEditing = field.currentEditor() != nil
        // Never fight the creator's caret: only push text in when this is not
        // the field being typed in.
        if !isEditing, field.stringValue != textCase.apply(to: text) {
            field.stringValue = textCase.apply(to: text)
        }
        if isFocused, !isEditing {
            DispatchQueue.main.async {
                guard field.window?.firstResponder !== field.currentEditor() else { return }
                field.window?.makeFirstResponder(field)
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: CaptionTextField

        init(parent: CaptionTextField) {
            self.parent = parent
        }

        /// Editing works on the words as spoken, never on the cased display
        /// form. AppKit has no text-transform, so typing into an UPPERCASED
        /// field would otherwise store the shouting permanently.
        func controlTextDidBeginEditing(_ obj: Notification) {
            parent.onFocus()
            // The app owns undo, not the field.
            //
            // A field editor keeps its own undo stack and claims ⌘Z the moment
            // it has focus, so editing a caption and pressing ⌘Z undid nothing
            // anybody could see: the editor swallowed the key and the project's
            // own history never heard about it. Caption edits are recorded as
            // project history like every other edit, and this is what lets ⌘Z
            // reach it.
            if let editor = (obj.object as? NSTextField)?.currentEditor() as? NSTextView {
                editor.allowsUndo = false
            }
            guard let field = obj.object as? NSTextField, field.stringValue != parent.text else {
                return
            }
            field.stringValue = parent.text
            let end = (parent.text as NSString).length
            field.currentEditor()?.selectedRange = NSRange(location: end, length: 0)
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            parent.text = field.stringValue
        }

        func controlTextDidEndEditing(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            // Keep the field editor's final value before restoring display
            // casing. The project update is deliberately coalesced, so
            // `parent.text` can still be one beat behind a just-finished edit.
            let finalText = field.stringValue
            field.stringValue = parent.textCase.apply(to: parent.text)
            parent.onEndEditing(finalText)
        }

        func control(
            _ control: NSControl,
            textView: NSTextView,
            doCommandBy selector: Selector
        ) -> Bool {
            switch selector {
            case #selector(NSResponder.insertNewline(_:)):
                return splitAtCaret(in: textView)
            case #selector(NSResponder.deleteBackward(_:)):
                return mergeUpAtStart(of: textView)
            case #selector(NSResponder.moveUp(_:)):
                parent.onStep(-1)
                return true
            case #selector(NSResponder.moveDown(_:)):
                parent.onStep(1)
                return true
            case #selector(NSResponder.cancelOperation(_:)):
                // Escape hands the keyboard back to the editor, so the next
                // Space plays rather than typing.
                textView.window?.makeFirstResponder(nil)
                return true
            default:
                return false
            }
        }

        private func splitAtCaret(in textView: NSTextView) -> Bool {
            let value = textView.string as NSString
            let caret = min(textView.selectedRange().location, value.length)
            let wordsBefore = value.substring(to: caret)
                .split(whereSeparator: \.isWhitespace).count
            let tail = value.substring(from: caret).trimmingCharacters(in: .whitespaces)
            // Nothing left to split off means the caret is at the end, and
            // Return there is how every list of lines adds the next one.
            guard wordsBefore > 0, !tail.isEmpty else {
                guard tail.isEmpty else { return false }
                parent.onAddAfter()
                return true
            }
            parent.onSplit(wordsBefore)
            return true
        }

        /// Backspace only merges when it would otherwise do nothing: the caret
        /// at position zero with no selection. Anywhere else it deletes.
        private func mergeUpAtStart(of textView: NSTextView) -> Bool {
            let selection = textView.selectedRange()
            guard selection.location == 0, selection.length == 0 else { return false }
            parent.onMergeUp()
            return true
        }
    }
}
