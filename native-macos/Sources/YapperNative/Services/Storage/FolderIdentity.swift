import Foundation

/// Whether two URLs name the same folder on disk: one through a symlink, one
/// with a trailing slash, or different case on a disk that ignores case.
enum FolderIdentity {
    static func same(_ first: URL, _ second: URL) -> Bool {
        let keys: Set<URLResourceKey> = [.fileResourceIdentifierKey]
        if let left = try? first.resourceValues(forKeys: keys).fileResourceIdentifier,
           let right = try? second.resourceValues(forKeys: keys).fileResourceIdentifier
        {
            return left.isEqual(right)
        }
        return resolved(first) == resolved(second)
    }

    private static func resolved(_ url: URL) -> String {
        url.standardizedFileURL.resolvingSymlinksInPath().path
    }
}
