import Foundation

/// A shelf in the library's rail.
///
/// Filtering rather than scrolling is the whole point of the rail: twenty-odd
/// sounds in one column meant hunting, and the one you want is nearly always
/// "a click" or "one of mine".
enum AudioLibrarySection: Hashable, Identifiable {
    case all
    case yours
    case savedKind(SavedAudioKind)
    case builtIn
    case effects(SoundEffectCategory)

    var id: String {
        switch self {
        case .all: "all"
        case .yours: "yours"
        case let .savedKind(kind): "saved-\(kind.rawValue)"
        case .builtIn: "built-in"
        case let .effects(category): "effect-\(category.rawValue)"
        }
    }

    var title: String {
        switch self {
        case .all: "Everything"
        case .yours: "Yours"
        case let .savedKind(kind): kind.title
        case .builtIn: "Built in"
        case let .effects(category): category.title
        }
    }

    var icon: String {
        switch self {
        case .all: "square.grid.2x2"
        case .yours: "person"
        case let .savedKind(kind): kind.icon
        case .builtIn: "shippingbox"
        case let .effects(category): category.icon
        }
    }

    /// True for the two rows that head a half of the library, which are drawn
    /// as headings with their children indented under them.
    var isHeading: Bool {
        switch self {
        case .yours, .builtIn: true
        default: false
        }
    }

    var isIndented: Bool {
        switch self {
        case .savedKind, .effects: true
        default: false
        }
    }

    func contains(_ entry: AudioEntry) -> Bool {
        switch self {
        case .all:
            return true
        case .yours:
            return entry.isSaved
        case let .savedKind(kind):
            return entry.saved?.kind == kind
        case .builtIn:
            return !entry.isSaved
        case let .effects(category):
            return entry.effect?.category == category
        }
    }

    /// The rail, in order. Built once here so the page cannot drift from the
    /// counts beside it.
    static var rail: [AudioLibrarySection] {
        [.all, .yours]
            + SavedAudioKind.allCases.map(AudioLibrarySection.savedKind)
            + [.builtIn]
            + SoundEffectCategory.allCases.map(AudioLibrarySection.effects)
    }
}

/// What the grid shows, given the rail and the search field.
enum AudioLibraryFilter {
    /// Matched on the name and on the line under it, because "swoosh" is a
    /// name and "cash register" is a description, and the creator searching for
    /// either means the same thing.
    static func matches(_ entry: AudioEntry, search: String) -> Bool {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return true }
        return entry.name.localizedCaseInsensitiveContains(query)
            || entry.detail.localizedCaseInsensitiveContains(query)
            || entry.group.localizedCaseInsensitiveContains(query)
    }

    static func entries(
        _ all: [AudioEntry],
        section: AudioLibrarySection,
        search: String
    ) -> [AudioEntry] {
        all.filter { section.contains($0) && matches($0, search: search) }
    }

    /// How many a shelf holds under the current search, for the rail's counts.
    /// Counting what the search would show, not what the shelf holds in total,
    /// is what makes the rail usable as a search result summary.
    static func count(
        _ all: [AudioEntry],
        section: AudioLibrarySection,
        search: String
    ) -> Int {
        entries(all, section: section, search: search).count
    }

    /// The grid's headings, in the order the entries come in. Only shown when
    /// a shelf holds more than one kind of thing; a filtered shelf is already
    /// its own heading, in the rail.
    static func groups(_ entries: [AudioEntry]) -> [(title: String, entries: [AudioEntry])] {
        var order: [String] = []
        var byGroup: [String: [AudioEntry]] = [:]
        for entry in entries {
            if byGroup[entry.group] == nil { order.append(entry.group) }
            byGroup[entry.group, default: []].append(entry)
        }
        return order.map { ($0, byGroup[$0] ?? []) }
    }
}
