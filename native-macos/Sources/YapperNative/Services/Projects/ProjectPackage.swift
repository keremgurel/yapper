import Foundation

/// One project on disk: a folder with a `.yapperproj` extension that Finder
/// shows as a single document. Imported footage is saved in the background inside the package, alongside
/// downloaded Studio recordings and generated assets.
struct ProjectPackage: Hashable, Sendable {
    static let pathExtension = "yapperproj"

    let url: URL

    /// One folder is one package, whether its URL came from a directory
    /// listing (which ends in a slash) or from a saved path (which doesn't).
    static func == (lhs: ProjectPackage, rhs: ProjectPackage) -> Bool {
        lhs.identity == rhs.identity
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(identity)
    }

    private var identity: String { url.standardizedFileURL.path }

    var projectFileURL: URL { url.appending(path: "project.json", directoryHint: .notDirectory) }
    var backupFileURL: URL { url.appending(path: "project.backup.json", directoryHint: .notDirectory) }
    var summaryFileURL: URL { url.appending(path: "summary.json", directoryHint: .notDirectory) }
    var posterFileURL: URL { url.appending(path: "poster.jpg", directoryHint: .notDirectory) }

    /// The folder name without the extension, which is what the creator named it.
    var displayName: String { url.deletingPathExtension().lastPathComponent }

    static func isPackage(_ url: URL) -> Bool {
        url.pathExtension.lowercased() == pathExtension
    }

    /// A folder name Finder and the file system will both accept.
    static func fileName(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = trimmed
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        return (cleaned.isEmpty ? "Untitled project" : cleaned) + "." + pathExtension
    }
}
