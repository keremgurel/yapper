import AppKit
import Foundation

/// Transport and immutable asset persistence for Chirpy's generated media.
@MainActor
enum GeneratedOverlayService {
    static func request(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        var request = await YapperAPI.authenticatedRequest(url: YapperAPI.url(path: "api/\(path)"))
        request.httpMethod = "POST"
        request.timeoutInterval = 300
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NativeEditorError.aiFailed("Chirpy returned no response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw YapperAPI.failure(status: http.statusCode, body: data, action: "Creating overlays")
        }
        try Task.checkCancellation()
        guard data.count <= 100 * 1024 * 1024,
              let reply = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeEditorError.aiFailed("Chirpy returned an unreadable overlay.")
        }
        return reply
    }

    static func palette(_ brand: [String: Any]?) -> ScenePalette {
        let colors = brand?["palette"] as? [String: String] ?? [:]
        let house = ScenePalette.house
        return ScenePalette(primary: colors["primary"].flatMap(StudioColor.init(hex:)) ?? house.primary,
            secondary: colors["secondary"].flatMap(StudioColor.init(hex:)) ?? house.secondary,
            accent: colors["accent"].flatMap(StudioColor.init(hex:)) ?? house.accent,
            ink: colors["ink"].flatMap(StudioColor.init(hex:)) ?? house.ink,
            surface: colors["surface"].flatMap(StudioColor.init(hex:)) ?? house.surface,
            muted: colors["muted"].flatMap(StudioColor.init(hex:)) ?? house.muted)
    }

    static func save(
        reply: [String: Any], brand: [String: Any]?, moment: [String: Any],
        size: CGSize, instruction: String, root: URL, existing: ProjectMedia? = nil,
        takenNames: [String] = []
    ) async throws -> ProjectMedia {
        let id = existing?.id ?? UUID()
        let version = existing?.generated?.nextVersionNumber ?? 1
        // A fresh subfolder also versions pictures: undo never reads a picture
        // overwritten by a subsequent revision that reused the same image key.
        let folder = GeneratedAssetLayout.folder(for: id, in: root)
            .appending(path: "v\(version)-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        if let existing, let scene = try? SceneExportLayer.loadScene(for: existing) {
            for asset in scene.imageAssets {
                guard let name = GeneratedAssetLayout.imageFileName(forAsset: asset) else { continue }
                let source = existing.url.deletingLastPathComponent().appending(path: name)
                let destination = folder.appending(path: name)
                if FileManager.default.fileExists(atPath: source.path), !FileManager.default.fileExists(atPath: destination.path) {
                    try FileManager.default.copyItem(at: source, to: destination)
                }
            }
        }
        for image in reply["images"] as? [[String: Any]] ?? [] {
            guard let key = image["key"] as? String,
                  let name = GeneratedAssetLayout.imageFileName(forAsset: "image:\(key)"),
                  let encoded = image["data"] as? String, encoded.count <= 9 * 1024 * 1024,
                  let bytes = Data(base64Encoded: encoded) else { continue }
            try writePNG(bytes, to: folder.appending(path: name))
        }
        if referencesLogo(reply["scene"]),
           !FileManager.default.fileExists(atPath: folder.appending(path: "brand-logo.png").path),
           let logo = (brand?["logos"] as? [[String: Any]])?.first,
           let raw = logo["url"] as? String, let url = URL(string: raw), url.scheme == "https" {
            let (download, response) = try await URLSession.shared.download(from: url)
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
               let size = try download.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 6 * 1024 * 1024 {
                try writePNG(Data(contentsOf: download), to: folder.appending(path: "brand-logo.png"))
            }
        }
        try Task.checkCancellation()
        let names = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        let keys = Set(names.filter { $0.hasPrefix("image-") && $0.hasSuffix(".png") }.map { String($0.dropFirst(6).dropLast(4)) })
        guard let raw = reply["scene"],
              let validated = SceneValidator.validate(raw, options: .init(imageKeys: keys, hasBrandLogo: names.contains("brand-logo.png"))) else {
            throw NativeEditorError.aiFailed("The generated overlay was invalid. Nothing was added.")
        }
        let scene = SceneLayoutQuality.fittingTextBoxes(scene: validated.scene, size: size)
        let layoutIssues = SceneLayoutQuality.issues(scene: scene, size: size)
        guard layoutIssues.isEmpty else {
            throw NativeEditorError.aiFailed("The overlay did not pass the readability check. Nothing was added. " + layoutIssues.prefix(3).joined(separator: " "))
        }
        let url = folder.appending(path: GeneratedAssetLayout.sceneFileName(version: version))
        try scene.encoded().write(to: url, options: .atomic)
        let palette = existing?.generated?.palette ?? palette(brand)
        let posterName = GeneratedAssetLayout.posterFileName(version: version)
        guard let poster = ScenePosterRenderer.render(scene: scene, size: size, palette: palette,
                assets: FileSceneAssetResolver(folder: folder)),
              let png = NSBitmapImageRep(cgImage: poster).representation(using: .png, properties: [:]) else {
            throw NativeEditorError.aiFailed("The overlay preview could not be rendered.")
        }
        try png.write(to: folder.appending(path: posterName), options: .atomic)
        var record = existing?.generated ?? GeneratedOverlayRecord(
            description: reply["description"] as? String ?? "",
            brief: moment["brief"] as? String ?? instruction, quote: moment["quote"] as? String ?? "",
            cue: moment["cue"] as? String, kind: moment["kind"] as? String ?? "other", palette: palette)
        record.description = reply["description"] as? String ?? record.description
        record.versions.append(.init(number: version, fileName: url.lastPathComponent,
            posterFileName: posterName, instruction: instruction,
            notes: (reply["notes"] as? [String] ?? []) + validated.notes
                + (scene == validated.scene ? [] : ["Fitted text boxes to native font metrics without changing typography."])))
        let baseName = String((reply["name"] as? String ?? existing?.name ?? "Generated visual").prefix(80))
        var name = baseName
        var suffix = 2
        while takenNames.contains(name) { name = "\(baseName) (\(suffix))"; suffix += 1 }
        return ProjectMedia(id: id, url: url, name: name, duration: scene.duration,
            width: Int(size.width), height: Int(size.height), hasAudio: false, kind: .scene, generated: record)
    }

    private static func writePNG(_ data: Data, to url: URL) throws {
        guard let image = NSBitmapImageRep(data: data), image.pixelsWide <= 8192, image.pixelsHigh <= 8192,
              let png = image.representation(using: .png, properties: [:]) else {
            throw NativeEditorError.aiFailed("An overlay image could not be read.")
        }
        try png.write(to: url, options: .atomic)
    }

    private static func referencesLogo(_ value: Any?) -> Bool {
        guard let node = value as? [String: Any] else { return false }
        if node["type"] as? String == "image", node["asset"] as? String == "brand.logo" { return true }
        return ((node["nodes"] as? [Any] ?? []) + (node["children"] as? [Any] ?? [])).contains { referencesLogo($0) }
    }
}
