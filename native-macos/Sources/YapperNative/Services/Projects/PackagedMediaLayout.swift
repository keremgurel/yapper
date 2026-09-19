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
        for index in result.audioLayers?.indices ?? 0..<0 {
            guard let layer = result.audioLayers?[index], let id = layer.packagedMediaID else { continue }
            result.audioLayers?[index].url = file(for: id, extension: layer.url.pathExtension, in: root)
        }
        return result
    }

    static func copyAssets(in project: EditorProject, to root: URL) throws {
        let sources = project.media.filter { $0.packagedSource == true }.map { ($0.id, $0.url) }
            + (project.audioLayers ?? []).compactMap { layer in layer.packagedMediaID.map { ($0, layer.url) } }
        var copied: Set<URL> = []
        for (id, source) in sources {
            let target = file(for: id, extension: source.pathExtension, in: root)
            guard copied.insert(target).inserted, target.standardizedFileURL != source.standardizedFileURL else { continue }
            try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: source, to: target)
        }
    }
}
