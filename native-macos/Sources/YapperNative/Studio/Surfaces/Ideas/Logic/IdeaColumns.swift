import CoreGraphics

/// The column vocabulary a view can switch on, and how wide each one is.
enum IdeaColumn: String, CaseIterable, Identifiable {
    case title, pillar, formats, type, transcript, status, script, updated, actions
    var id: String { rawValue }

    var label: String {
        switch self {
        case .title: "Title"
        case .pillar: "Pillar"
        case .formats: "Format"
        case .type: "Type"
        case .transcript: "Reference"
        case .status: "Status"
        case .script: "Script"
        case .updated: "Updated"
        case .actions: ""
        }
    }

    /// The name the column picker shows.
    var pickerLabel: String { self == .actions ? "Actions" : label }

    /// Fixed width; `nil` for the title, which takes the slack.
    var width: CGFloat? {
        switch self {
        case .title: nil
        case .pillar: 150
        case .formats: 170
        case .type: 120
        case .transcript: 130
        case .status: 130
        case .script: 90
        case .updated: 150
        case .actions: 72
        }
    }

    var sortKey: IdeaSortKey? {
        switch self {
        case .title: .title
        case .pillar: .pillar
        case .type: .type
        case .status: .status
        case .script: .script
        case .updated: .updated
        case .formats, .transcript, .actions: nil
        }
    }

    /// What the list shows before a view picks its own columns.
    static let defaults: [IdeaColumn] = [.title, .pillar, .formats, .status, .script, .updated, .actions]

    /// The columns a view renders. An empty saved list means the defaults, and
    /// the title is always in front: a row with no title is unusable.
    static func resolve(_ saved: [String]?) -> [IdeaColumn] {
        let chosen = (saved ?? []).compactMap(IdeaColumn.init(rawValue:))
        if chosen.isEmpty { return defaults }
        return chosen.contains(.title) ? chosen : [.title] + chosen
    }

    /// The table needs this much width before the title starts to squeeze.
    static func minimumWidth(_ columns: [IdeaColumn]) -> CGFloat {
        columns.reduce(28 + 220 + 32) { $0 + ($1.width ?? 0) + 12 }
    }
}
