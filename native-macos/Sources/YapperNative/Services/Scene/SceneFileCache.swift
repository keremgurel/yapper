import Foundation

/// Decoded scenes by file, so a preview redrawn thirty times a second does not
/// read and parse the same JSON thirty times a second.
///
/// Keyed by the file's path and modification date. A revised design is a new
/// file, so a stale entry would only ever come from a file rewritten in place,
/// and the date catches that too.
@MainActor
final class SceneFileCache {
    static let shared = SceneFileCache()

    private struct Key: Hashable {
        let path: String
        let modified: Date?
    }

    private var scenes: [Key: OverlayScene] = [:]

    init() {}

    func scene(at url: URL) -> OverlayScene? {
        let modified = (try? FileManager.default.attributesOfItem(atPath: url.path)[.modificationDate]) as? Date
        let key = Key(path: url.path, modified: modified)
        if let cached = scenes[key] { return cached }
        guard let data = try? Data(contentsOf: url),
              let scene = try? OverlayScene.decode(data)
        else { return nil }
        // Every earlier version of the same path goes: a project keeps a
        // handful of scenes, not a history of them.
        scenes = scenes.filter { $0.key.path != url.path }
        scenes[key] = scene
        return scene
    }

    func forget(_ url: URL) {
        scenes = scenes.filter { $0.key.path != url.path }
    }
}
