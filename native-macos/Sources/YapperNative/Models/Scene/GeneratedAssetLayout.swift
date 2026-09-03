import CoreGraphics
import Foundation
import ImageIO

/// Where a generated overlay's files live and what they are called.
///
/// One folder per asset inside the project package, `generated/<mediaID>/`.
/// Every design is an immutable numbered file, so the document's snapshot undo
/// restores an earlier design by pointing `ProjectMedia.url` back at it, and
/// nothing is ever overwritten. Pictures the design uses sit beside the scene
/// files under the names the scene refers to them by.
enum GeneratedAssetLayout {
    static let folderName = "generated"
    static let brandLogoAsset = "brand.logo"
    static let imagePrefix = "image:"

    /// The asset's folder inside `root`, which is the package or its stand-in.
    static func folder(for mediaID: UUID, in root: URL) -> URL {
        root
            .appending(path: folderName, directoryHint: .isDirectory)
            .appending(path: mediaID.uuidString, directoryHint: .isDirectory)
    }

    /// The asset folder a saved scene file sits in.
    static func folder(ofSceneFile url: URL) -> URL {
        url.deletingLastPathComponent()
    }

    static func sceneFileName(version: Int) -> String { "v\(version).scene.json" }
    static func posterFileName(version: Int) -> String { "v\(version).poster.png" }

    /// Packages can be renamed or duplicated. Only generated media belongs
    /// inside them; external camera footage keeps its original location.
    static func relocated(_ project: EditorProject, to root: URL) -> EditorProject {
        var result = project
        for index in result.media.indices where result.media[index].isScene {
            let media = result.media[index]
            let parts = media.url.pathComponents
            guard let marker = parts.lastIndex(of: folderName), parts.count > marker + 2,
                  parts[marker + 1] == media.id.uuidString else { continue }
            let destination = parts[(marker + 1)...].reduce(root.appending(path: folderName)) { $0.appending(path: $1) }
            if MediaAvailability.isRegularReadableFile(destination) { result.media[index].url = destination }
        }
        return result
    }

    static func copyAssets(in project: EditorProject, to root: URL) throws {
        for media in project.media where media.isScene {
            let parts = media.url.pathComponents
            guard let marker = parts.lastIndex(of: folderName), parts.count > marker + 2,
                  parts[marker + 1] == media.id.uuidString else { continue }
            let source = URL(filePath: NSString.path(withComponents: Array(parts.prefix(marker + 2))))
            let destination = folder(for: media.id, in: root)
            guard source.standardizedFileURL != destination.standardizedFileURL else { continue }
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            // Never overwrite another package's generated history.
            try FileManager.default.copyItem(at: source, to: destination)
        }
    }

    /// The file a scene's `image` node refers to, or nil when the reference is
    /// not one the format allows.
    static func imageFileName(forAsset asset: String) -> String? {
        if asset == brandLogoAsset { return "brand-logo.png" }
        guard asset.hasPrefix(imagePrefix) else { return nil }
        let key = String(asset.dropFirst(imagePrefix.count))
        guard !key.isEmpty, key.count <= SceneLimits.maxIdLength,
              key.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") })
        else { return nil }
        return "image-\(key).png"
    }
}

/// Answers a scene's picture references with pixels.
protocol SceneAssetResolving: Sendable {
    /// The picture for `brand.logo` or `image:<key>`, or nil when it is not
    /// available, in which case the renderer leaves that node out.
    func image(forAsset asset: String) -> CGImage?
}

/// Resolves references against the files in one asset folder.
struct FileSceneAssetResolver: SceneAssetResolving {
    let folder: URL

    init(folder: URL) { self.folder = folder }

    init(sceneFile url: URL) { folder = GeneratedAssetLayout.folder(ofSceneFile: url) }

    func image(forAsset asset: String) -> CGImage? {
        guard let name = GeneratedAssetLayout.imageFileName(forAsset: asset) else { return nil }
        let url = folder.appending(path: name, directoryHint: .notDirectory)
        guard MediaAvailability.isRegularReadableFile(url),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil)
        else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }
}

/// A resolver with nothing in it, for scenes that use no pictures and for tests.
struct EmptySceneAssetResolver: SceneAssetResolving {
    init() {}
    func image(forAsset asset: String) -> CGImage? { nil }
}
