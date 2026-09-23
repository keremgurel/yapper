import Foundation

/// How much prompt a surface spends on the Brain, in characters.
struct BrainSurfaceBudget: Codable, Equatable, Sendable {
    let core: Int
    let index: Int
    let loaded: Int
}

/// Exactly what one surface sends, as `/api/brain/preview` compiles it.
struct BrainPreview: Codable, Equatable, Sendable {
    struct Used: Codable, Equatable, Sendable {
        let skills: [String]
        let context: [String]
    }

    struct Entry: Codable, Equatable, Sendable {
        let ref: String
        let id: String
        let type: String
        let line: String
        let loaded: Bool
    }

    let surface: String
    let budget: BrainSurfaceBudget
    let core: String
    let index: String
    let loaded: String
    let section: String
    let used: Used
    let entries: [Entry]

    /// JavaScript's `length` counts UTF-16 units, and the budgets are in them.
    static func length(_ text: String) -> Int { text.utf16.count }
}
