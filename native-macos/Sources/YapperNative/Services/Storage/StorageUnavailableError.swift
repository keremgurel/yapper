import Foundation

/// A write that couldn't happen because its folder isn't there.
struct StorageUnavailableError: LocalizedError, Equatable {
    let kind: StorageKind
    let folder: URL
    let availability: StorageAvailability

    var errorDescription: String? {
        StorageWarningCopy.problem(kind: kind, folder: folder, availability: availability)
    }
}

/// The words for a folder that can't be used, shared by the banner, the
/// Storage page and every save that fails because of it.
enum StorageWarningCopy {
    /// `inStorage` drops the pointer to the Storage page for text shown on it.
    static func problem(kind: StorageKind, folder: URL, availability: StorageAvailability, inStorage: Bool = false) -> String? {
        let elsewhere = inStorage ? "" : " in Storage"
        switch availability {
        case .available:
            return nil
        case .driveDisconnected(let name):
            return "“\(name)” isn’t connected. Plug it in to use the \(kind.phrase) saved there, or choose another folder\(elsewhere)."
        case .folderMissing:
            return "The folder for \(kind.phrase), “\(folder.lastPathComponent)”, was moved or deleted. Choose another folder\(elsewhere)."
        }
    }

    /// One line for several kinds on the same drive or folder.
    static func summary(kinds: [StorageKind], availability: StorageAvailability) -> String? {
        let names = ListFormatter.localizedString(byJoining: kinds.map(\.phrase))
        switch availability {
        case .available:
            return nil
        case .driveDisconnected(let name):
            return "“\(name)” isn’t connected. Your \(names) saved there can’t be opened or saved until you plug it back in."
        case .folderMissing:
            return "The folder for your \(names) was moved or deleted. Choose another folder so new files have somewhere to go."
        }
    }
}
