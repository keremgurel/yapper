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
    case dictionary
    case connections
    /// Not a tab. The page a signed-out window shows, in place of everything.
    case signIn

    var id: String { rawValue }

    /// Drawn by the app itself rather than loaded from the web.
    ///
    /// The editor is native because a browser cannot cut video the way this
    /// does, and the audio library is native because it is a folder of real
    /// files on this Mac. Everything else is the same page the browser shows.
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
        case .brand, .dictionary, .connections: "Settings"
        case .signIn: ""
        }
    }

    static let groups: [(String, [StudioDestination])] = [
        ("", [.home]),
        ("Lab", [.brain, .ideas, .library]),
        ("Studio", [.recorder, .editor, .audio]),
        ("Press", [.poster, .calendar, .automations]),
        ("Settings", [.brand, .dictionary, .connections]),
    ]
}
