import Foundation

/// Small text rules the canvas shows: script length, speaking time, hook
/// identity, and the copy-to-clipboard outline.
enum IdeaCanvasText {
    static let wordsPerMinute = 150.0

    static func wordCount(_ text: String) -> Int {
        text.split(whereSeparator: { $0.isWhitespace }).count
    }

    /// "m:ss" at 150 words a minute.
    static func speakingTime(words: Int) -> String {
        let seconds = Int((Double(words) / wordsPerMinute * 60).rounded())
        return "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    /// A stable identity per hook so a line keeps its view as it moves between
    /// the Hook slot and the alternatives. Repeats get their occurrence.
    static func hookKeys(_ hooks: [String]) -> [String] {
        var seen: [String: Int] = [:]
        return hooks.map { hook in
            let count = seen[hook, default: 0]
            seen[hook] = count + 1
            return "\(hook)#\(count)"
        }
    }

    /// The paste-ready outline `ideaToScript` builds.
    static func copyableScript(_ item: IdeaCanvasItem) -> String {
        var lines = [item.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled idea" : item.title.trimmingCharacters(in: .whitespacesAndNewlines), ""]
        let hooks = item.hooks.map(trim).filter { !$0.isEmpty }
        if !hooks.isEmpty {
            lines.append("HOOK OPTIONS")
            lines += hooks.enumerated().map { "\($0.offset + 1). \($0.element)" }
            lines.append("")
        }
        let points = item.points.map(trim).filter { !$0.isEmpty }
        if !points.isEmpty {
            lines.append("KEY POINTS")
            lines += points.map { "- \($0)" }
            lines.append("")
        }
        if !trim(item.example).isEmpty { lines += ["EXAMPLE", trim(item.example), ""] }
        if !trim(item.cta).isEmpty { lines += ["CTA", trim(item.cta), ""] }
        if let script = item.script, !trim(script).isEmpty { lines += ["SCRIPT", trim(script)] }
        return trim(lines.joined(separator: "\n"))
    }

    private static func trim(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
