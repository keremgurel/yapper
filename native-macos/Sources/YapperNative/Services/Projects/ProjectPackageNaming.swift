import Foundation

extension ProjectPackage {
    /// A package URL in `folder` that nothing is using yet. The name is made
    /// unique the way Finder does it: "Day 25", then "Day 25 2".
    static func uniqueURL(for name: String, in folder: URL, excluding: URL? = nil) -> URL {
        let base = fileName(for: name)
        var candidate = folder.appending(path: base, directoryHint: .isDirectory)
        var counter = 2
        while FileManager.default.fileExists(atPath: candidate.path), candidate != excluding {
            let stem = String(base.dropLast(pathExtension.count + 1))
            candidate = folder.appending(path: "\(stem) \(counter).\(pathExtension)", directoryHint: .isDirectory)
            counter += 1
        }
        return candidate
    }
}
