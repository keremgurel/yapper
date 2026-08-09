import Foundation

/// What the library folder's index.json holds.
///
/// Versioned from the first write. A library is the one thing here a creator
/// builds up over months, so a format change has to be able to migrate rather
/// than start again.
struct AudioLibraryIndex: Codable, Equatable, Sendable {
    static let currentVersion = 1

    var version: Int
    var items: [SavedAudio]

    init(version: Int = AudioLibraryIndex.currentVersion, items: [SavedAudio] = []) {
        self.version = version
        self.items = items
    }
}

/// Naming, kept away from the disk so it can be reasoned about on its own.
enum AudioLibraryNaming {
    /// What an imported file is called before the creator renames it.
    ///
    /// Downloaded sounds arrive as `mixkit-fast-swoosh-1493-[AudioTrimmer].mp3`
    /// and reading a shelf of those is impossible, so the marketplace prefix,
    /// the numbers and the tool's own brackets come off.
    static func displayName(for url: URL) -> String {
        var stem = url.deletingPathExtension().lastPathComponent
        stem = stem.replacingOccurrences(
            of: #"\[[^\]]*\]"#,
            with: " ",
            options: .regularExpression
        )
        stem = stem.replacingOccurrences(of: #"[_\-]+"#, with: " ", options: .regularExpression)
        stem = stem.replacingOccurrences(of: #"\s+\d{3,}\s*"#, with: " ", options: .regularExpression)
        stem = stem.replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
        let cleaned = stem.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = cleaned.first else { return "Untitled audio" }
        return first.uppercased() + cleaned.dropFirst()
    }

    /// A file name no other item in the library is using.
    ///
    /// Two different files called `pop.mp3` are ordinary. One overwriting the
    /// other inside the library would be silent and permanent, so the second
    /// becomes `pop-2.mp3`.
    static func uniqueFileName(for url: URL, taken: Set<String>) -> String {
        let ext = url.pathExtension.isEmpty ? "m4a" : url.pathExtension.lowercased()
        let stem = sanitized(url.deletingPathExtension().lastPathComponent)
        var candidate = "\(stem).\(ext)"
        var suffix = 2
        while taken.contains(candidate.lowercased()) {
            candidate = "\(stem)-\(suffix).\(ext)"
            suffix += 1
        }
        return candidate
    }

    /// Keeps a file name to what every filesystem the folder might sit on can
    /// hold, including one synced to iCloud Drive later.
    private static func sanitized(_ stem: String) -> String {
        let allowed = stem.map { character -> Character in
            character.isLetter || character.isNumber || character == "-" || character == " "
                ? character
                : "-"
        }
        let collapsed = String(allowed)
            .replacingOccurrences(of: #"\s+"#, with: "-", options: .regularExpression)
            .replacingOccurrences(of: #"-{2,}"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let trimmed = String(collapsed.prefix(60))
        return trimmed.isEmpty ? "audio" : trimmed
    }
}
