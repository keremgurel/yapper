import Foundation

enum StudioDestination: String, CaseIterable, Identifiable {
    case home
    case brain
    case ideas
    case library
    case recorder
    case editor
    case audio
    case poster
    case calendar
    case automations
    case brand
    case storage
    case dictionary
    case connections
    /// Not a tab. The page a signed-out window shows, in place of everything.
    case signIn

    var id: String { rawValue }

    /// Drawn by the app itself rather than loaded from the web.
    ///
    /// The editor is the one deliberate platform difference. The rest of the
    /// visible Studio navigation loads the same route the browser shows.
    /// Audio remains an internal editor destination, not a second product tab.
    var isNative: Bool {
        self == .editor || self == .audio
    }

    var title: String {
        switch self {
        case .home: "Home"
        case .brain: "Brain"
        case .ideas: "Idea bank"
        case .library: "Content Library"
        case .recorder: "Recorder"
        case .editor: "Editor"
        case .audio: "Audio"
        case .poster: "Poster"
        case .calendar: "Calendar"
        case .automations: "Automations"
        case .brand: "Brand"
        case .storage: "Storage"
        case .dictionary: "Dictionary"
        case .connections: "Connections"
        case .signIn: "Sign in"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .brain: "brain"
        case .ideas: "lightbulb"
        case .library: "square.stack.3d.up"
        case .recorder: "video"
        case .editor: "scissors"
        case .audio: "music.note.list"
        case .poster: "paperplane"
        case .calendar: "calendar"
        case .automations: "bolt"
        case .brand: "paintpalette"
        case .storage: "externaldrive"
        case .dictionary: "character.book.closed"
        case .connections: "point.3.connected.trianglepath.dotted"
        case .signIn: "person.crop.circle"
        }
    }

    var group: String {
        switch self {
        case .home: ""
        case .brain, .ideas, .library: "Lab"
        case .recorder, .editor, .audio: "Studio"
        case .poster, .calendar, .automations: "Press"
        case .brand, .storage, .dictionary, .connections: "Settings"
        case .signIn: ""
        }
    }

    static let groups: [(String, [StudioDestination])] = [
        ("", [.home]),
        ("Lab", [.brain, .ideas, .library]),
        ("Studio", [.recorder, .editor]),
        ("Press", [.poster, .calendar, .automations]),
        ("Settings", [.brand, .storage, .dictionary, .connections]),
    ]
}
