import Foundation

/// What Chirpy says once a plan has run, worded from its receipts.
///
/// A plan is atomic: when one step fails every step is rolled back, and each
/// receipt carries the plan's status. Read naively that is the same error four
/// times under four ticks, which looks like four things went right. So the
/// step that failed is named once, and the steps that were only rolled back
/// with it are counted in one line.
enum ChirpyReceiptSummary {
    static let undoHint = "⌘Z to undo"
    private static let separator = " · "

    /// The message a step gets when another step in its plan failed.
    static let rolledBack = "Not applied: another step in this plan failed, so the whole plan was rolled back."

    /// The reply for a plan that landed. Identical messages are said once with
    /// a count ("3 overlays added"), and the undo hint once, at the end.
    static func success(_ messages: [String]) -> String {
        var order: [String] = []
        var counts: [String: Int] = [:]
        var offersUndo = false
        for message in messages where !message.isEmpty {
            let (body, undo) = splitUndo(message)
            offersUndo = offersUndo || undo
            if counts[body] == nil { order.append(body) }
            counts[body, default: 0] += 1
        }
        var lines = order.map { counted($0, times: counts[$0] ?? 1) }
        if offersUndo {
            if lines.isEmpty { lines = [undoHint] } else { lines[lines.count - 1] += separator + undoHint }
        }
        return lines.joined(separator: "\n")
    }

    /// The lines under a plan that did not land: each distinct problem once,
    /// then how many other steps were rolled back with it.
    static func troubleNotes(_ messages: [String]) -> [String] {
        var notes: [String] = []
        var rolledBackCount = 0
        for message in messages {
            if message == rolledBack { rolledBackCount += 1; continue }
            if !message.isEmpty, !notes.contains(message) { notes.append(message) }
        }
        if rolledBackCount > 0 {
            notes.append(rolledBackCount == 1
                ? "The other step in this plan was not applied, so nothing changed."
                : "The other \(rolledBackCount) steps in this plan were not applied, so nothing changed.")
        }
        return notes
    }

    private static func splitUndo(_ message: String) -> (body: String, undo: Bool) {
        let suffix = separator + undoHint
        if message.hasSuffix(suffix) { return (String(message.dropLast(suffix.count)), true) }
        if message == undoHint { return ("", true) }
        return (message, false)
    }

    /// "Overlay added" said three times is "3 overlays added". Anything that
    /// is not a plain noun and verb gets the count after it instead.
    static func counted(_ message: String, times: Int) -> String {
        guard times > 1 else { return message }
        let parts = message.components(separatedBy: separator)
        let head = parts[0], rest = parts.dropFirst()
        let words = head.split(separator: " ").map(String.init)
        let countedHead: String
        if words.count == 2, let noun = words.first, noun.first?.isUppercase == true,
           noun.allSatisfy(\.isLetter), words[1].hasSuffix("ed") {
            countedHead = "\(times) \(plural(noun.prefix(1).lowercased() + noun.dropFirst())) \(words[1])"
        } else {
            countedHead = "\(head) (\(times)×)"
        }
        return ([countedHead] + rest).joined(separator: separator)
    }

    private static func plural(_ noun: String) -> String {
        if ["s", "x", "ch", "sh"].contains(where: noun.hasSuffix) { return noun + "es" }
        if noun.hasSuffix("y"), let before = noun.dropLast().last, !"aeiou".contains(before) {
            return noun.dropLast() + "ies"
        }
        return noun + "s"
    }
}
