import Foundation

/// The YouTube upload choices the web's `youtube-settings.tsx` asks for:
/// visibility, the made-for-kids declaration YouTube requires, and whether
/// the video holds realistic altered or synthetic media. Like the web's
/// inline publish, uploads start public and not made for kids, the choices
/// most posts want, and stay one disclosure away from changing.
struct PosterYouTubeSettings: Equatable {
    enum Visibility: String, CaseIterable, Identifiable {
        case `private`, unlisted, `public`
        var id: String { rawValue }
        var label: String {
            switch self {
            case .private: "Private"
            case .unlisted: "Unlisted"
            case .public: "Public"
            }
        }
    }

    /// YouTube counts a description in bytes, so emoji and accents cost more.
    static let descriptionByteLimit = 5000

    var visibility = Visibility.public
    var madeForKids: Bool? = false
    var syntheticMedia = false

    /// The fields the YouTube routes read, added to an upload's body.
    var body: [String: Any?] {
        [
            "privacyStatus": visibility.rawValue,
            "selfDeclaredMadeForKids": madeForKids,
            "containsSyntheticMedia": syntheticMedia,
        ]
    }

    static func descriptionTooLong(_ description: String) -> Bool {
        description.trimmingCharacters(in: .whitespacesAndNewlines).utf8.count > descriptionByteLimit
    }
}
