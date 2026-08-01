import Foundation

enum StudioDestination: String, CaseIterable, Identifiable {
    case home
    case ideas
    case library
    case recorder
    case editor
    case poster
    case calendar
    case automations
    case dictionary
    case connections

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .ideas: "Idea bank"
        case .library: "Content Library"
        case .recorder: "Recorder"
        case .editor: "Editor"
        case .poster: "Poster"
        case .calendar: "Calendar"
        case .automations: "Automations"
        case .dictionary: "Dictionary"
        case .connections: "Connections"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .ideas: "lightbulb"
        case .library: "square.stack.3d.up"
        case .recorder: "video"
        case .editor: "scissors"
        case .poster: "paperplane"
        case .calendar: "calendar"
        case .automations: "bolt"
        case .dictionary: "character.book.closed"
        case .connections: "point.3.connected.trianglepath.dotted"
        }
    }

    var group: String {
        switch self {
        case .home: ""
        case .ideas, .library: "Lab"
        case .recorder, .editor: "Studio"
        case .poster, .calendar, .automations: "Press"
        case .dictionary, .connections: "Settings"
        }
    }

    static let groups: [(String, [StudioDestination])] = [
        ("", [.home]),
        ("Lab", [.ideas, .library]),
        ("Studio", [.recorder, .editor]),
        ("Press", [.poster, .calendar, .automations]),
        ("Settings", [.dictionary, .connections]),
    ]
}
