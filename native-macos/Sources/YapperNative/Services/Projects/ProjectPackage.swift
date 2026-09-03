import Foundation

/// One project on disk: a folder with a `.yapperproj` extension that Finder
/// shows as a single document. Source media is never copied in; the project
/// points at the files where they are, so a package is a few hundred kilobytes
/// however long the take.
struct ProjectPackage: Hashable, Sendable {
    static let pathExtension = "yapperproj"

    let url: URL

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
