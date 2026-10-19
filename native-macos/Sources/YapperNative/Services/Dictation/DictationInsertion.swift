import Foundation

/// Where dictated words go in a box that already has text: the web's
/// `insert-dictation`. Ranges are UTF-16, the text view's own units.
enum DictationInsertion {
    /// Splices the words in at the caret, replacing a selection, with the
    /// spacing inferred. Returns the new text and where the caret belongs.
    static func insert(_ words: String, into current: String, selection: NSRange) -> (text: String, caret: Int) {
        let spoken = words.trimmingCharacters(in: .whitespacesAndNewlines)
        let ns = current as NSString
        guard !spoken.isEmpty else { return (current, min(selection.location, ns.length)) }

        let validStart = selection.location != NSNotFound && selection.location >= 0 && selection.location <= ns.length
        let start = validStart ? selection.location : ns.length
        let end = validStart ? min(max(selection.location + selection.length, start), ns.length) : start

        let before = ns.substring(to: start)
        let after = ns.substring(from: end)
        let needsSpaceBefore = !before.isEmpty && !(before.last?.isWhitespace ?? false)
        let closers: Set<Character> = [".", ",", ";", ":", "!", "?", ")", "]", "}"]
        let needsSpaceAfter = !after.isEmpty && !(after.first.map { $0.isWhitespace || closers.contains($0) } ?? false)

        let middle = (needsSpaceBefore ? " " : "") + spoken + (needsSpaceAfter ? " " : "")
        let caret = (before as NSString).length + (middle as NSString).length - (needsSpaceAfter ? 1 : 0)
        return (before + middle + after, caret)
    }
}
