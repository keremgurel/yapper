import Foundation

/// Which of a project's files are still where the project left them.
///
/// A project holds paths, not footage, so a video can walk out from under an
/// open edit: an SD card ejected, a drive unplugged, a folder moved. Everything
/// downstream keeps working on a project that describes a video nobody can read,
/// and the only symptom is a preview that goes black. This is how the editor
/// finds out, so it can say so.
enum MediaAvailability {
    /// The media whose files are not there. Pure, and the check is injected, so
    /// the answer can be tested without unplugging anything.
    static func missing(
        in media: [ProjectMedia],
        exists: (URL) -> Bool = { FileManager.default.fileExists(atPath: $0.path) }
    ) -> [ProjectMedia] {
        media.filter { !exists($0.url) }
    }

    /// The name of the removable volume a file lived on, when it lived on one.
    ///
    /// Worth the trouble because "reconnect G MicroSD" is a thing the creator
    /// can act on, where a path they have to read to the end is not.
    static func volumeName(of url: URL) -> String? {
        let parts = url.pathComponents
        guard parts.count > 2, parts[1] == "Volumes" else { return nil }
        return parts[2]
    }
}
