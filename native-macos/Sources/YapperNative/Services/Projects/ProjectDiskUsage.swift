import Foundation

enum ProjectDiskUsage {
    /// Logical sizes, not a claim about physical blocks freed: APFS clones can
    /// share blocks, and Trash retains the files until the creator empties it.
    static func bytes(in directory: URL) -> Int64 {
        guard let files = FileManager.default.enumerator(at: directory, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey], options: [.skipsHiddenFiles]) else { return 0 }
        var total: Int64 = 0
        for case let file as URL in files {
            if let value = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]), value.isRegularFile == true {
                total += Int64(value.fileSize ?? 0)
            }
        }
        return total
    }

    static func label(_ bytes: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
    }
}
