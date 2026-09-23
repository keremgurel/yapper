import Foundation

/// Rewrites long and short dashes into the punctuation the app uses, as
/// `lib/text/undash.ts` does. Between two numbers a dash is a range and
/// becomes "to"; anywhere else it is a pause and becomes a comma.
enum IdeaCanvasUndash {
    /// The two dash characters, spelled as escapes so none sits in the source.
    private static let dashes = "\u{2013}\u{2014}"

    private static let rules: [(NSRegularExpression, String)] = [
        (#"(\d)\s*[\#(dashes)]\s*(\d)"#, "$1 to $2"),
        (#"\s*[\#(dashes)]\s*"#, ", "),
        (#",\s*,"#, ","),
        (#"\(\s*,\s*"#, "("),
        (#",\s*\)"#, ")"),
        (#"^,\s*"#, ""),
        (#",\s*$"#, ""),
        (#",\s*([.!?;:])"#, "$1"),
    ].map { pattern, template in
        // swiftlint:disable:next force_try
        (try! NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines]), template)
    }

    static func apply(_ text: String) -> String {
        rules.reduce(text) { current, rule in
            let range = NSRange(current.startIndex..., in: current)
            return rule.0.stringByReplacingMatches(in: current, range: range, withTemplate: rule.1)
        }
    }
}
