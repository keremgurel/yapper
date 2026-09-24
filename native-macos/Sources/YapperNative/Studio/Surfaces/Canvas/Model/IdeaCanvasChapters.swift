import Foundation

/// Chapters in a long-form script, the same rules as the server's
/// `lib/ideas/versions/chapters.ts`: a chapter is a line starting with `## `,
/// and `[B-ROLL: ...]` / `[ON SCREEN: ...]` lines are notes, never spoken.
enum IdeaCanvasChapters {
    struct Chapter: Equatable, Identifiable {
        let index: Int
        let title: String
        var words: Int
        var id: Int { index }
    }

    /// YouTube drops a video's chapter list with fewer than this many.
    static let youTubeMinimum = 3

    static func title(of line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("## ") else { return nil }
        let title = trimmed.dropFirst(3).trimmingCharacters(in: .whitespaces)
        return title.isEmpty ? nil : title
    }

    static func isNote(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return trimmed.hasSuffix("]") && (trimmed.hasPrefix("[B-ROLL") || trimmed.hasPrefix("[ON SCREEN"))
    }

    static func spokenWords(_ line: String) -> Int {
        title(of: line) != nil || isNote(line) ? 0 : IdeaCanvasText.wordCount(line)
    }

    static func chapters(in script: String) -> [Chapter] {
        var chapters: [Chapter] = []
        for line in script.components(separatedBy: "\n") {
            if let title = title(of: line) {
                chapters.append(Chapter(index: chapters.count, title: title, words: 0))
            } else if !chapters.isEmpty {
                chapters[chapters.count - 1].words += spokenWords(line)
            }
        }
        return chapters
    }

    static func spokenWordCount(_ script: String) -> Int {
        script.components(separatedBy: "\n").reduce(0) { $0 + spokenWords($1) }
    }

    /// "About 9 min", rounded to the minute, from spoken words only.
    static func runtime(words: Int) -> String {
        let minutes = max(1, Int((Double(words) / IdeaCanvasText.wordsPerMinute).rounded()))
        return "about \(minutes) min"
    }

    /// Minutes to read an article at 230 words a minute.
    static func readingTime(words: Int) -> String {
        "\(max(1, Int((Double(words) / 230).rounded()))) min read"
    }
}
