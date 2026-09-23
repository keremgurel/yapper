import Foundation

/// Turns something Chirpy said into a block for the page, as
/// `lib/content/note-to-block.ts` does. A reply that reads as a list becomes
/// bullets (numbered lines become steps); anything else is a paragraph. The
/// label comes from what was asked.
enum IdeaCanvasNoteToBlock {
    private static let bullet = try! NSRegularExpression(pattern: #"^\s*(?:[-*•·]|\d{1,2}[.)])\s+(.*\S)\s*$"#)
    private static let numbered = try! NSRegularExpression(pattern: #"^\s*\d{1,2}[.)]"#)
    private static let question = try! NSRegularExpression(
        pattern: #"^(what are|what is|what's|whats|give me|list|show me|tell me|can you|could you|please|write|add|suggest)\s+(the\s+|some\s+|a\s+|an\s+)?"#,
        options: [.caseInsensitive]
    )
    private static let endPunctuation = try! NSRegularExpression(pattern: #"[?.!]+$"#)

    static func block(note: String, asked: String) -> IdeaCanvasBlockInput {
        let lines = note.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let listed = lines.filter { matches(bullet, $0) }
        let label = label(for: asked)
        if lines.count >= 2, Double(listed.count) >= (Double(lines.count) * 0.6).rounded(.up) {
            let allNumbered = listed.allSatisfy { matches(numbered, $0) }
            return IdeaCanvasBlockInput(
                label: label,
                kind: allNumbered ? .steps : .bullets,
                items: listed.map { replace(bullet, in: $0, with: "$1") }
            )
        }
        return IdeaCanvasBlockInput(label: label, kind: .paragraph, text: note.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// A heading out of a question: the leading question words go, the rest is
    /// capitalised and cut to a label's length.
    static func label(for asked: String) -> String {
        var stripped = replace(endPunctuation, in: asked.trimmingCharacters(in: .whitespacesAndNewlines), with: "")
        stripped = replace(question, in: stripped, with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        let text = stripped.isEmpty ? "Notes" : stripped
        var cut = text
        if text.count > 40 {
            let head = String(text.prefix(40))
            if let range = head.range(of: #"\s+\S*$"#, options: .regularExpression) {
                cut = String(head[..<range.lowerBound])
            } else {
                cut = head
            }
        }
        return cut.prefix(1).uppercased() + cut.dropFirst()
    }

    private static func matches(_ regex: NSRegularExpression, _ text: String) -> Bool {
        regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    private static func replace(_ regex: NSRegularExpression, in text: String, with template: String) -> String {
        regex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: template)
    }
}
