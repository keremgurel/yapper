import Foundation

enum ClipControlCommand: Equatable {
    case speed(Double, all: Bool)
    case lock(Bool, captions: Bool, all: Bool)

    static func parse(_ instruction: String) -> Self? {
        let text = instruction.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if let match = text.range(of: #"\b(?:\d+(?:\.\d+)?|\.\d+)\s*[x×]\b|\b\d+(?:\.\d+)?\s*×"#, options: .regularExpression),
           text.range(of: #"\b(?:speed|clips?|video|faster|slower)\b"#, options: .regularExpression) != nil {
            let number = text[match].filter { $0.isNumber || $0 == "." }
            if let rate = Double(number), ClipSpeed.range.contains(rate) {
                return .speed(rate, all: text.range(of: #"\b(?:all|every|whole|entire)\b"#, options: .regularExpression) != nil)
            }
        }
        let pattern = #"^(?:please\s+)?(unlock|lock)\s+(?:(all|every|selected|these|this|the)\s+)?(clips?|captions?)\s*[.!]?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        let parts = (1...3).map { index in Range(match.range(at: index), in: text).map { String(text[$0]) } ?? "" }
        let selected = ["selected", "these", "this"].contains(parts[1])
        return .lock(parts[0] == "lock", captions: parts[2].hasPrefix("caption"),
                     all: !selected && (parts[2].hasSuffix("s") || parts[1] == "every"))
    }
}
