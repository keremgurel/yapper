import Foundation

/// The formats an idea can hold a version of, and the words each one's page
/// uses. Titles and headlines ride on the same list as hooks: the first
/// option is the one in use, the rest are alternatives.
enum IdeaCanvasVersionFormat: String, CaseIterable, Identifiable, Codable {
    case short, long, article
    var id: String { rawValue }

    var label: String {
        switch self {
        case .short: "Short-form"
        case .long: "Long-form"
        case .article: "Article"
        }
    }

    var tone: NativeChip.Tone {
        switch self {
        case .short: .cyan
        case .long: .violet
        case .article: .blue
        }
    }

    /// "the long-form", for sentences such as "Write the long-form".
    var noun: String {
        switch self {
        case .short: "short"
        case .long: "long-form"
        case .article: "article"
        }
    }

    var openerLabel: String {
        switch self {
        case .short: "Hook"
        case .long: "Title"
        case .article: "Headline"
        }
    }

    var alternativesLabel: String {
        switch self {
        case .short: "Hook alternatives"
        case .long: "Title options"
        case .article: "Headline options"
        }
    }

    var bodyLabel: String { self == .article ? "Article" : "Script" }

    var askForOpeners: String {
        switch self {
        case .short: "Give me five hooks"
        case .long: "Give me five video titles"
        case .article: "Give me five headlines"
        }
    }

    var askForMoreOpeners: String {
        switch self {
        case .short: "Give me three more hook alternatives with different angles"
        case .long: "Give me three more video titles with different angles"
        case .article: "Give me three more headlines with different angles"
        }
    }

    var askToWriteBody: String {
        switch self {
        case .short: "Write the script"
        case .long: "Write the long-form script with ## chapter lines"
        case .article: "Write the article"
        }
    }
}
