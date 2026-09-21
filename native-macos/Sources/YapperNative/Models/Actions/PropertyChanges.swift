import Foundation

/// Before/after receipts for property sets, read off the encoded values so an
/// executor does not have to hand-list every field it might touch. Nested
/// objects flatten to dotted paths (`framing.scale`, `appearance.fontScale`).
enum PropertyChanges {
    static func diff(
        targetID: UUID,
        before: some Encodable,
        after: some Encodable,
        prefix: String = ""
    ) throws -> [AppActionChange] {
        let old = flatten(try ActionJSON.encoding(before), prefix: prefix)
        let new = flatten(try ActionJSON.encoding(after), prefix: prefix)
        return Set(old.keys).union(new.keys).sorted().compactMap { key in
            guard old[key] != new[key] else { return nil }
            return AppActionChange(targetID: targetID, property: key, before: describe(old[key]), after: describe(new[key]))
        }
    }

    /// The field names a diff touched, without their target or prefix, for a
    /// status line like "Caption style: fontScale, color".
    static func fieldNames(_ changes: [AppActionChange]) -> [String] {
        var seen = Set<String>()
        return changes.compactMap { change in
            let name = String(change.property.split(separator: ".").last ?? Substring(change.property))
            return seen.insert(name).inserted ? name : nil
        }
    }

    private static func flatten(_ value: ActionJSON, prefix: String) -> [String: ActionJSON] {
        guard case .object(let fields) = value else { return [prefix.isEmpty ? "value" : prefix: value] }
        var result: [String: ActionJSON] = [:]
        for (key, child) in fields {
            let path = prefix.isEmpty ? key : "\(prefix).\(key)"
            if case .object = child {
                result.merge(flatten(child, prefix: path)) { _, new in new }
            } else {
                result[path] = child
            }
        }
        return result
    }

    static func describe(_ value: ActionJSON?) -> String {
        switch value {
        case .none, .null: "none"
        case .string(let text): text
        case .number(let number): String(number)
        case .bool(let flag): String(flag)
        case .array(let values): values.map(describe).joined(separator: ", ")
        case .object: "object"
        }
    }
}
