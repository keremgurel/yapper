import Foundation

/// Any JSON value. Brain edits travel as small dictionaries of these, so two
/// edits to the same record merge key by key before one PATCH goes out.
enum BrainJSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([BrainJSONValue])
    case object([String: BrainJSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([BrainJSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: BrainJSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    static func strings(_ values: [String]) -> BrainJSONValue {
        .array(values.map(BrainJSONValue.string))
    }
}

/// A partial record: only the keys that changed.
typealias BrainPatch = [String: BrainJSONValue]

extension Dictionary where Key == String, Value == BrainJSONValue {
    /// This patch with a newer one laid over it.
    func overlaid(with newer: BrainPatch) -> BrainPatch {
        merging(newer) { _, new in new }
    }
}
