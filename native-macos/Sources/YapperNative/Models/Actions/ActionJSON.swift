import Foundation

/// JSON values stay typed across schema validation and Codable input decoding.
indirect enum ActionJSON: Codable, Equatable, Sendable {
    case object([String: ActionJSON]), array([ActionJSON]), string(String), number(Double), bool(Bool), null

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let bool = try? value.decode(Bool.self) { self = .bool(bool) }
        else if let number = try? value.decode(Double.self) { self = .number(number) }
        else if let text = try? value.decode(String.self) { self = .string(text) }
        else if let list = try? value.decode([ActionJSON].self) { self = .array(list) }
        else { self = .object(try value.decode([String: ActionJSON].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self {
        case .object(let object): try value.encode(object)
        case .array(let array): try value.encode(array)
        case .string(let string): try value.encode(string)
        case .number(let number): try value.encode(number)
        case .bool(let bool): try value.encode(bool)
        case .null: try value.encodeNil()
        }
    }

    subscript(_ key: String) -> ActionJSON? {
        guard case .object(let fields) = self else { return nil }
        return fields[key]
    }
    var text: String? { if case .string(let text) = self { text } else { nil } }
    var list: [ActionJSON]? { if case .array(let values) = self { values } else { nil } }
    var numeric: Double? { if case .number(let number) = self { number } else { nil } }

    static func encoding(_ value: some Encodable) throws -> ActionJSON {
        try JSONDecoder().decode(ActionJSON.self, from: JSONEncoder().encode(value))
    }
}

struct AppActionError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
    init(_ message: String) { self.message = message }
}

/// The subset used by the checked-in contract. Its generator rejects unsupported
/// shape types; constraints are checked here before Codable can ignore extra keys.
enum ActionSchema {
    static let document: ActionJSON = {
        do { return try JSONDecoder().decode(ActionJSON.self, from: Data(AppActionContract.schemaJSON.utf8)) }
        catch { preconditionFailure("Invalid generated action schema: \(error)") }
    }()

    static func definition(_ name: String) -> ActionJSON {
        guard let definition = document["$defs"]?[name] else { preconditionFailure("Missing action schema: \(name)") }
        return definition
    }

    static func validate(_ value: ActionJSON, against schema: ActionJSON, path: String = "arguments") throws {
        func invalid() -> AppActionError { AppActionError("Invalid \(path).") }
        if let ref = schema["$ref"]?.text {
            try validate(value, against: definition(String(ref.split(separator: "/").last!)), path: path)
            return
        }
        if let constant = schema["const"], value != constant { throw invalid() }
        if let options = schema["enum"]?.list, !options.contains(value) { throw invalid() }
        switch schema["type"]?.text {
        case "object":
            guard case .object(let fields) = value else { throw invalid() }
            let required = schema["required"]?.list?.compactMap(\.text) ?? []
            guard required.allSatisfy({ fields[$0] != nil }) else { throw invalid() }
            for (key, child) in fields {
                if let property = schema["properties"]?[key] {
                    try validate(child, against: property, path: "\(path).\(key)")
                } else if schema["additionalProperties"] == .bool(false) { throw invalid() }
            }
        case "array":
            guard case .array(let values) = value,
                  Double(values.count) >= (schema["minItems"]?.numeric ?? 0),
                  Double(values.count) <= (schema["maxItems"]?.numeric ?? .infinity) else { throw invalid() }
            if schema["uniqueItems"] == .bool(true) {
                var encoded = Set<Data>()
                let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
                for child in values where !encoded.insert(try encoder.encode(child)).inserted { throw invalid() }
            }
            if let item = schema["items"] {
                for child in values { try validate(child, against: item, path: path + "[]") }
            }
        case "string":
            guard case .string(let text) = value,
                  Double(text.count) >= (schema["minLength"]?.numeric ?? 0),
                  Double(text.count) <= (schema["maxLength"]?.numeric ?? .infinity),
                  schema["format"]?.text != "uuid" || UUID(uuidString: text) != nil else { throw invalid() }
        case "number", "integer":
            guard case .number(let number) = value, number.isFinite,
                  number >= (schema["minimum"]?.numeric ?? -.infinity),
                  number <= (schema["maximum"]?.numeric ?? .infinity),
                  schema["type"]?.text != "integer" || number.rounded() == number else { throw invalid() }
        case "boolean":
            guard case .bool = value else { throw invalid() }
        default: throw AppActionError("Unsupported action schema.")
        }
    }
}
