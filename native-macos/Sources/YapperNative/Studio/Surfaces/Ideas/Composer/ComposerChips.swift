import AppKit

/// Moving between the draft's plain text and the text view's display, where
/// each platform link is one attachment character. The draft (and anything
/// that reads it, like submitting or dictation) only ever sees plain text.
enum ComposerChips {
    /// The plain text: every chip back to its URL.
    static func plain(from display: NSAttributedString) -> String {
        var result = ""
        let ns = display.string as NSString
        var cursor = 0
        display.enumerateAttribute(.attachment, in: NSRange(location: 0, length: display.length)) { value, range, _ in
            guard let chip = value as? ComposerLinkAttachment else { return }
            result += ns.substring(with: NSRange(location: cursor, length: range.location - cursor)) + chip.url
            cursor = range.location + range.length
        }
        return result + ns.substring(from: cursor)
    }

    /// A display offset as a plain-text offset: each chip before it counts
    /// as its whole URL.
    static func plainOffset(_ offset: Int, in display: NSAttributedString) -> Int {
        var shift = 0
        let end = min(offset, display.length)
        display.enumerateAttribute(.attachment, in: NSRange(location: 0, length: end)) { value, _, _ in
            if let chip = value as? ComposerLinkAttachment { shift += (chip.url as NSString).length - 1 }
        }
        return offset + shift
    }

    /// A plain-text offset as a display offset. One that falls inside a
    /// chipped URL lands just after the chip.
    static func displayOffset(_ offset: Int, in display: NSAttributedString) -> Int {
        var plain = 0
        var result = 0
        while result < display.length {
            let width = (display.attribute(.attachment, at: result, effectiveRange: nil) as? ComposerLinkAttachment)
                .map { ($0.url as NSString).length } ?? 1
            if plain + width > offset { return plain == offset ? result : result + 1 }
            plain += width
            result += 1
        }
        return result
    }

    /// Platform links in the display text that should become chips. A link
    /// the caret sits at the end of is still being typed, unless it arrived
    /// in one go (a paste).
    static func pending(in text: String, caret: Int?, pasted: Bool) -> [(NSRange, LinkPlatform)] {
        let ns = text as NSString
        return CaptureText.linkRanges(in: text).compactMap { range in
            guard let platform = LinkPlatform(url: ns.substring(with: range)) else { return nil }
            if let caret, !pasted, range.location + range.length == caret { return nil }
            return (range, platform)
        }
    }
}
