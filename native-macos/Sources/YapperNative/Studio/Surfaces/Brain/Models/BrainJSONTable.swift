import Foundation

/// A pasted JSON array of flat objects, read as a table. The union of keys
/// becomes the columns so a record missing a field still lines up.
enum BrainJSONTable {
    static func parse(_ text: String) -> BrainTable? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("["),
              let data = trimmed.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? [Any],
              !array.isEmpty else { return nil }
        let records = array.compactMap { $0 as? [String: Any] }
        guard records.count == array.count else { return nil }

        var seen = Set<String>()
        var keys: [String] = []
        for record in records {
            for key in record.keys where !seen.contains(key) {
                seen.insert(key)
                keys.append(key)
            }
        }
        guard !keys.isEmpty else { return nil }
        // Foundation forgets key order, so put the columns back in the order
        // the paste first names them.
        let columns = keys.sorted { position(of: $0, in: trimmed) < position(of: $1, in: trimmed) }
        return BrainTable(columns: columns, rows: records.map { record in
            columns.map { cell(record[$0]) }
        })
    }

    private static func position(of key: String, in text: String) -> Int {
        guard let range = text.range(of: "\"\(key)\"") else { return Int.max }
        return text.distance(from: text.startIndex, to: range.lowerBound)
    }

    /// A cell as JavaScript's `String()` would print it.
    static func cell(_ value: Any?) -> String {
        switch value {
        case nil, is NSNull: return ""
        case let string as String: return string
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() { return number.boolValue ? "true" : "false" }
            return number.stringValue
        case let other?:
            guard JSONSerialization.isValidJSONObject(other),
                  let data = try? JSONSerialization.data(withJSONObject: other),
                  let string = String(data: data, encoding: .utf8) else { return "" }
            return string
        }
    }
}
