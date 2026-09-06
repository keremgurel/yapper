import Foundation

/// Downloaded Studio sources travel with their project; imported camera files
/// retain their original locations.
enum PackagedMediaLayout {
    static func file(for id: UUID, extension ext: String, in root: URL) -> URL {
        root.appending(path: "recordings", directoryHint: .isDirectory)
            .appending(path: "\(id.uuidString).\(ext)", directoryHint: .notDirectory)
    }

    static func relocated(_ project: EditorProject, to root: URL) -> EditorProject {
        var result = project
        for index in result.media.indices where result.media[index].packagedSource == true {
            let media = result.media[index]
            // Point into the current package even if missing so recovery never
            // silently reads a different copy of the original package's file.
            result.media[index].url = file(for: media.id, extension: media.url.pathExtension, in: root)
        }
        return result
    }

    static func copyAssets(in project: EditorProject, to root: URL) throws {
        for media in project.media where media.packagedSource == true {
            let target = file(for: media.id, extension: media.url.pathExtension, in: root)
            guard target.standardizedFileURL != media.url.standardizedFileURL else { continue }
            try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: media.url, to: target)
        }
    }
}
