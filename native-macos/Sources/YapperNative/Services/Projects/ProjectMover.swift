import Foundation

/// Moves a project package into another folder without ever leaving the only
/// copy half written.
///
/// On the same disk a move is a rename. Across disks the package is copied
/// under a hidden name, forced onto the drive, compared byte for byte with the
/// original, renamed into place, and only then does the original go to the
/// Trash, where it can still be recovered.
enum ProjectMover {
    struct Moved: Equatable, Sendable {
        let from: URL
        let to: URL
        /// True when the package crossed disks and its original went to the
        /// Trash.
        let originalInTrash: Bool
        /// True when the copy is in place but the original couldn't be put in
        /// the Trash, so both copies exist.
        let originalKept: Bool
    }

    enum MoveError: LocalizedError, Equatable {
        case copyDidNotMatch(String)

        var errorDescription: String? {
            switch self {
            case .copyDidNotMatch(let name):
                "The copy of “\(name)” didn’t match the original, so it was removed and the original wasn’t touched."
            }
        }
    }

    /// Nil when the package is already in `folder`, which leaves it alone.
    ///
    /// `alwaysCopy`, `copy` and `trash` let tests run the across-disks path on
    /// one disk, spoil a copy, and keep the creator's Trash out of it.
    static func move(
        _ package: ProjectPackage,
        into folder: URL,
        alwaysCopy: Bool = false,
        copy: (URL, URL) throws -> Void = { try FileManager.default.copyItem(at: $0, to: $1) },
        trash: (URL) throws -> Void = { try FileManager.default.trashItem(at: $0, resultingItemURL: nil) }
    ) throws -> Moved? {
        if FolderIdentity.same(package.url.deletingLastPathComponent(), folder) { return nil }
        let manager = FileManager.default
        let destination = ProjectPackage.uniqueURL(for: package.displayName, in: folder)
        if !alwaysCopy, StorageVolume.sameVolume(package.url, folder) {
            try manager.moveItem(at: package.url, to: destination)
            return Moved(from: package.url, to: destination, originalInTrash: false, originalKept: false)
        }
        let staging = ProjectMoveStaging.url(in: folder)
        do {
            try copy(package.url, staging)
            try DiskFlush.flushTree(staging)
            guard copyMatches(package.url, staging) else {
                throw MoveError.copyDidNotMatch(package.displayName)
            }
            try manager.moveItem(at: staging, to: destination)
            try DiskFlush.flush(folder)
        } catch {
            try? manager.removeItem(at: staging)
            throw error
        }
        do {
            try trash(package.url)
            return Moved(from: package.url, to: destination, originalInTrash: true, originalKept: false)
        } catch {
            return Moved(from: package.url, to: destination, originalInTrash: false, originalKept: true)
        }
    }

    /// The same files, each with the same bytes.
    static func copyMatches(_ original: URL, _ copy: URL) -> Bool {
        let files = contents(of: original)
        guard files == contents(of: copy) else { return false }
        let left = rootPath(original), right = rootPath(copy)
        return files.keys.allSatisfy { FileManager.default.contentsEqual(atPath: left + $0, andPath: right + $0) }
    }

    /// Every file in a package by its path inside it, with its size.
    ///
    /// `._` files are left out. A drive without native extended attributes,
    /// such as an exFAT USB stick, stores a file's attributes (the quarantine
    /// flag on footage from Downloads, say) in a visible `._name` file beside
    /// it, which the original on the Mac doesn't have.
    static func contents(of folder: URL) -> [String: Int] {
        let root = rootPath(folder)
        guard let files = FileManager.default.enumerator(
            at: folder,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]
        ) else { return [:] }
        var sizes: [String: Int] = [:]
        for case let file as URL in files where !file.lastPathComponent.hasPrefix("._") {
            guard let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                  values.isRegularFile == true else { continue }
            let path = file.standardizedFileURL.resolvingSymlinksInPath().path
            sizes[String(path.dropFirst(root.count))] = values.fileSize ?? 0
        }
        return sizes
    }

    private static func rootPath(_ folder: URL) -> String {
        folder.standardizedFileURL.resolvingSymlinksInPath().path
    }
}
