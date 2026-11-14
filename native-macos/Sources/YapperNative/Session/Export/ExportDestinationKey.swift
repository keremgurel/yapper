import Foundation

/// One string per file on disk, however its URL was spelled.
///
/// Two exports writing one file would each replace the other's result, so the
/// guard has to see `/tmp/a.mp4` and `/private/tmp/a.mp4` as one file, and on
/// a case-insensitive volume `Export.mp4` and `export.mp4` too. The file
/// itself usually does not exist yet, so the folder is resolved, not the file:
/// resolving a missing path leaves `/private/tmp` as it was.
enum ExportDestinationKey {
    static func of(_ url: URL) -> String {
        let folder = url.deletingLastPathComponent().resolvingSymlinksInPath().standardizedFileURL
        return folder.appending(path: url.lastPathComponent).path
            .precomposedStringWithCanonicalMapping
            .folding(options: .caseInsensitive, locale: nil)
    }
}
