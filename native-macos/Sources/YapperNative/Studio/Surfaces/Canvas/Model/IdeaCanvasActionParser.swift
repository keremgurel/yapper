import Foundation

/// Reads Chirpy's reply into actions, the same way `parseCanvasActions` does.
/// Anything malformed is dropped rather than repaired, and indexes are checked
/// against the document the ask was made for, so a stale reply cannot land on
/// the wrong block.
enum IdeaCanvasActionParser {
    static func parse(_ value: Any?, blockCount: Int) -> [IdeaCanvasAction] {
        guard let root = value as? [String: Any], let list = root["actions"] as? [Any] else { return [] }
        var actions: [IdeaCanvasAction] = []
        for entry in list.prefix(IdeaCanvasActions.maxActions) {
            guard let raw = entry as? [String: Any] else { continue }
            switch raw["type"] as? String {
            case "replace":
                guard let block = parseBlock(raw["block"]), let index = integer(raw["index"]),
                      index >= 0, index < blockCount else { break }
                actions.append(.replace(index: index, block: block))
            case "insert":
                guard let block = parseBlock(raw["block"]) else { break }
                let rawAfter = raw["after"]
                if rawAfter == nil || rawAfter is NSNull {
                    actions.append(.insert(after: nil, block: block))
                } else if let after = integer(rawAfter), after >= 0, after < blockCount {
                    actions.append(.insert(after: after, block: block))
                }
            case "append":
                if let block = parseBlock(raw["block"]) { actions.append(.append(block: block)) }
            case "hooks":
                let options = (raw["options"] as? [Any] ?? [])
                    .map { clip($0, IdeaCanvasActions.maxHook) }
                    .filter { !$0.isEmpty }
                    .prefix(IdeaCanvasActions.maxHooks)
                if !options.isEmpty {
                    actions.append(.hooks(options: Array(options), replace: isTrue(raw["replace"])))
                }
            case "title":
                let title = clip(raw["title"], IdeaCanvasActions.maxTitle)
                if !title.isEmpty { actions.append(.title(title)) }
            default:
                break
            }
        }
        return actions
    }

    static func parseBlock(_ value: Any?) -> IdeaCanvasBlockInput? {
        guard let raw = value as? [String: Any] else { return nil }
        let rawItems = raw["items"] as? [Any]
        let kind: IdeaCanvasBlockKind = (raw["kind"] as? String).flatMap(IdeaCanvasBlockKind.init(rawValue:))
            ?? (rawItems != nil ? .bullets : .paragraph)
        let label = clip(raw["label"], IdeaCanvasActions.maxLabel)
        let items = Array((rawItems ?? [])
            .map { clip($0, IdeaCanvasActions.maxItem) }
            .filter { !$0.isEmpty }
            .prefix(IdeaCanvasActions.maxItems))
        let text = clip(raw["text"], IdeaCanvasActions.maxText)
        if kind.isList {
            if items.isEmpty && text.isEmpty { return nil }
            let listed = items.isEmpty
                ? text.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                : items
            return IdeaCanvasBlockInput(label: label, kind: kind, items: listed)
        }
        if text.isEmpty && items.isEmpty { return nil }
        return IdeaCanvasBlockInput(label: label, kind: kind, text: text.isEmpty ? items.joined(separator: "\n") : text)
    }

    private static func clip(_ value: Any?, _ max: Int) -> String {
        guard let string = value as? String else { return "" }
        return String(IdeaCanvasUndash.apply(string.trimmingCharacters(in: .whitespacesAndNewlines)).prefix(max))
    }

    /// JavaScript's `Number(x)` followed by `Number.isInteger`.
    private static func integer(_ value: Any?) -> Int? {
        let number: Double?
        switch value {
        case let n as NSNumber: number = n.doubleValue
        case let s as String:
            let trimmed = s.trimmingCharacters(in: .whitespaces)
            number = trimmed.isEmpty ? 0 : Double(trimmed)
        default: number = nil
        }
        guard let number, number.isFinite, number.rounded() == number, abs(number) < 1e9 else { return nil }
        return Int(number)
    }

    private static func isTrue(_ value: Any?) -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return false }
        return number.boolValue
    }
}
