import Foundation

/// Whether a folder the creator just picked can hold files, checked before it
/// is saved as their choice rather than at the first failed save.
enum StorageFolderCheck {
    /// Nil when the folder works; otherwise the reason, ready to show.
    static func problem(with folder: URL) -> String? {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: folder.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return "Choose a folder."
        }
        if folder.standardizedFileURL.pathComponents.contains(where: { $0.lowercased().hasSuffix("." + ProjectPackage.pathExtension) }) {
            return "Choose a folder outside a project."
        }
        let probe = folder.appending(path: ".yapper-write-check-\(UUID().uuidString)", directoryHint: .notDirectory)
        do {
            try Data().write(to: probe)
            try? FileManager.default.removeItem(at: probe)
        } catch {
            return "Yapper can’t save into “\(folder.lastPathComponent)”. Choose a folder you can write to."
        }
        return nil
    }
}
