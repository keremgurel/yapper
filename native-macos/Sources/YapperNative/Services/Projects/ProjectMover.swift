import Foundation

/// Moves a project package into another folder without ever leaving the only
/// copy half written.
///
/// On the same disk a move is a rename. Across disks the package is copied
/// under a hidden name, the copy is checked file by file against the
/// original, it is renamed into place, and only then does the original go to
/// the Trash, where it can still be recovered.
enum ProjectMover {
    struct Moved: Equatable, Sendable {
        let from: URL
        let to: URL
        /// True when the package crossed disks and its original went to the
        /// Trash, so emptying the Trash is what frees the space.
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

    /// `alwaysCopy` and `trash` let tests run the across-disks path on one disk
    /// without filling the creator's Trash.
    static func move(
        _ package: ProjectPackage,
        into folder: URL,
        alwaysCopy: Bool = false,
        trash: (URL) throws -> Void = { try FileManager.default.trashItem(at: $0, resultingItemURL: nil) }
    ) throws -> Moved {
        let manager = FileManager.default
        let destination = ProjectPackage.uniqueURL(for: package.displayName, in: folder)
        if !alwaysCopy, StorageVolume.sameVolume(package.url, folder) {
            try manager.moveItem(at: package.url, to: destination)
            return Moved(from: package.url, to: destination, originalInTrash: false, originalKept: false)
        }
        let staging = folder.appending(
            path: ".moving-\(UUID().uuidString).\(ProjectPackage.pathExtension)",
            directoryHint: .isDirectory
        )
        do {
            try manager.copyItem(at: package.url, to: staging)
            guard contents(of: package.url) == contents(of: staging) else {
                throw MoveError.copyDidNotMatch(package.displayName)
            }
            try manager.moveItem(at: staging, to: destination)
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

    /// Every file in a package by its path inside it, with its size.
    static func contents(of folder: URL) -> [String: Int] {
        let root = folder.standardizedFileURL.resolvingSymlinksInPath().path
        guard let files = FileManager.default.enumerator(
            at: folder,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]
        ) else { return [:] }
        var sizes: [String: Int] = [:]
        for case let file as URL in files {
            guard let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                  values.isRegularFile == true else { continue }
            let path = file.standardizedFileURL.resolvingSymlinksInPath().path
            sizes[String(path.dropFirst(root.count))] = values.fileSize ?? 0
        }
        return sizes
    }
}
