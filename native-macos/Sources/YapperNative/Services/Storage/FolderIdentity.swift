import Foundation

/// Whether two URLs name the same folder on disk: one through a symlink, one
/// with a trailing slash, or different case on a disk that ignores case.
enum FolderIdentity {
    /// Links are followed first: a link's own identifier describes the link,
    /// not the folder it points to.
    static func same(_ first: URL, _ second: URL) -> Bool {
        let first = resolved(first), second = resolved(second)
        let keys: Set<URLResourceKey> = [.fileResourceIdentifierKey]
        if let left = try? first.resourceValues(forKeys: keys).fileResourceIdentifier,
           let right = try? second.resourceValues(forKeys: keys).fileResourceIdentifier
        {
            return left.isEqual(right)
        }
        return first.path == second.path
    }

    private static func resolved(_ url: URL) -> URL {
        url.standardizedFileURL.resolvingSymlinksInPath()
    }
}
