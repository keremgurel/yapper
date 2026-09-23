import Foundation

/// What a paste turned out to be. The same rules as the web's `detectPaste`,
/// run on this Mac, so a five thousand row export is laid out before anything
/// leaves the machine and only a small sample is ever sent to be named.
struct BrainDetectedPaste: Equatable, Sendable {
    var kind: BrainBlockKind
    var body: String
    var items: [String]
    var rows: BrainTable?
    /// The small piece the naming pass sees. Never the whole paste.
    var sample: String
    var characters: Int

    /// The shape and the counts, in one line.
    var shape: String {
        if let rows { return "a table of \(rows.rows.count) rows and \(rows.columns.count) columns" }
        if !items.isEmpty { return "a list of \(items.count) lines" }
        return "\(characters) characters of \(kind == .doc ? "document" : "note") text"
    }
}

enum BrainPasteDetector {
    private static let delimiters: [Character] = ["\t", ",", ";", "|"]
    /// A bullet: dash, star, dot, middle dot, en dash (U+2013), or a number.
    private static let bulletMarker = "^\\s*(?:[-*\u{2022}\u{00B7}\u{2013}]|\\d{1,3}[.)])\\s+"
    private static let docThreshold = 1_500
    private static let maxSampleRows = 20
    private static let maxSampleChars = 2_000

    /// Always returns something usable; the fallback is a note.
    static func detect(_ input: String) -> BrainDetectedPaste {
        let text = input.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let count = text.utf16.count

        if let table = BrainJSONTable.parse(text) ?? delimitedTable(lines) {
            var paste = BrainDetectedPaste(kind: .table, body: "", items: [], rows: table, sample: "", characters: count)
            paste.sample = sample(of: paste)
            return paste
        }
        if let items = list(lines) {
            var paste = BrainDetectedPaste(kind: .list, body: "", items: items, rows: nil, sample: "", characters: count)
            paste.sample = sample(of: paste)
            return paste
        }
        var paste = BrainDetectedPaste(kind: count > docThreshold ? .doc : .note, body: text, items: [], rows: nil, sample: "", characters: count)
        paste.sample = sample(of: paste)
        return paste
    }

    /// One line of delimited text, respecting quotes and doubled quotes.
    static func split(_ line: String, by delimiter: Character) -> [String] {
        var cells: [String] = []
        var cell = ""
        var quoted = false
        var characters = Array(line)[...]
        while let char = characters.popFirst() {
            if quoted {
                if char != "\"" { cell.append(char) }
                else if characters.first == "\"" { cell.append("\""); characters.removeFirst() }
                else { quoted = false }
                continue
            }
            if char == "\"" { quoted = true }
            else if char == delimiter { cells.append(cell.trimmingCharacters(in: .whitespaces)); cell = "" }
            else { cell.append(char) }
        }
        cells.append(cell.trimmingCharacters(in: .whitespaces))
        return cells
    }

    static func delimitedTable(_ lines: [String]) -> BrainTable? {
        guard lines.count >= 3 else { return nil }
        let fits = delimiters.compactMap { delimiter -> (Character, Int, Double)? in
            let counts = lines.map { split($0, by: delimiter).count }
            guard let columns = counts.first, columns >= 2 else { return nil }
            let agreement = Double(counts.filter { $0 == columns }.count) / Double(counts.count)
            return (delimiter, columns, agreement)
        }
        // Stable: the first delimiter wins a tie, as in the web sort.
        guard let best = fits.enumerated().min(by: { lhs, rhs in
            if lhs.element.2 != rhs.element.2 { return lhs.element.2 > rhs.element.2 }
            if lhs.element.1 != rhs.element.1 { return lhs.element.1 > rhs.element.1 }
            return lhs.offset < rhs.offset
        })?.element, best.2 >= 0.8 else { return nil }

        let rows = lines.map { split($0, by: best.0) }.filter { $0.count == best.1 }
        guard rows.count >= 2, !readsAsProse(rows), let first = rows.first else { return nil }
        let looksLikeHeader = first.allSatisfy { cell in
            !cell.isEmpty && cell.range(of: "^-?[\\d.,%$\u{20AC}\u{00A3}\\s]+$", options: .regularExpression) == nil
        }
        return looksLikeHeader
            ? BrainTable(columns: first, rows: Array(rows.dropFirst()))
            : BrainTable(columns: first.indices.map { "Column \($0 + 1)" }, rows: rows)
    }

    /// Sentence-shaped cells mean prose that happened to have commas in it.
    static func readsAsProse(_ rows: [[String]]) -> Bool {
        let cells = rows.flatMap { $0 }.filter { !$0.isEmpty }
        guard !cells.isEmpty else { return true }
        let sentences = cells.filter { $0.range(of: "[.!?]$", options: .regularExpression) != nil }.count
        let average = Double(cells.reduce(0) { $0 + $1.utf16.count }) / Double(cells.count)
        return Double(sentences) / Double(cells.count) > 0.2 || average > 40
    }

    static func list(_ lines: [String]) -> [String]? {
        guard lines.count >= 3 else { return nil }
        let bulleted = lines.filter { $0.range(of: bulletMarker + "\\S", options: .regularExpression) != nil }.count
        guard Double(bulleted) / Double(lines.count) >= 0.6 else { return nil }
        return lines.map { line in
            line.replacingOccurrences(of: bulletMarker, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
        }.filter { !$0.isEmpty }
    }

    static func sample(of paste: BrainDetectedPaste) -> String {
        if let table = paste.rows {
            let head = ([table.columns.joined(separator: " | ")]
                + table.rows.prefix(maxSampleRows).map { $0.joined(separator: " | ") }).joined(separator: "\n")
            let hidden = table.rows.count - maxSampleRows
            return String((hidden > 0 ? "\(head)\n(and \(hidden) more rows)" : head).prefix(maxSampleChars))
        }
        if !paste.items.isEmpty {
            let head = paste.items.prefix(maxSampleRows).map { "- \($0)" }.joined(separator: "\n")
            let hidden = paste.items.count - maxSampleRows
            return String((hidden > 0 ? "\(head)\n(and \(hidden) more lines)" : head).prefix(maxSampleChars))
        }
        guard paste.body.count > maxSampleChars else { return paste.body }
        let half = maxSampleChars / 2
        return "\(paste.body.prefix(half))\n\u{2026}\n\(paste.body.suffix(half))"
    }
}
