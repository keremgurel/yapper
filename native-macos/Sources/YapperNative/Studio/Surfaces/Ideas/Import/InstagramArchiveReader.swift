import Foundation

/// Unpacks an Instagram export on this Mac into filename to text. Only JSON
/// and HTML documents within the size limits are read, so a bloated archive
/// cannot take the app's memory with it.
enum InstagramArchiveReader {
    enum Failure: String, Error {
        case tooLarge, fileType, noSaves, readFailed

        var message: String {
            switch self {
            case .tooLarge: "That archive is over 100 MB. Export only Saved items from Instagram and try again."
            case .fileType: "Choose the ZIP, JSON, or HTML file from your Instagram export."
            case .noSaves: "No Instagram post or Reel links were found. Make sure Saved items were included in the export."
            case .readFailed: "Yapper could not read that export. The file is untouched. Try the original ZIP from Instagram."
            }
        }
    }

    static let maxArchiveBytes = 100 * 1024 * 1024
    static let maxDocumentBytes = 20 * 1024 * 1024
    static let maxExtractedBytes = 80 * 1024 * 1024

    static func read(_ file: URL) throws -> [String: String] {
        let size = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size <= maxArchiveBytes else { throw Failure.tooLarge }
        let ext = file.pathExtension.lowercased()
        if ext != "zip" {
            guard ["json", "html", "htm"].contains(ext) else { throw Failure.fileType }
            guard let data = try? Data(contentsOf: file) else { throw Failure.readFailed }
            return [file.lastPathComponent: String(decoding: data, as: UTF8.self)]
        }
        return try unzipDocuments(file)
    }

    private static func unzipDocuments(_ archive: URL) throws -> [String: String] {
        let destination = FileManager.default.temporaryDirectory.appending(path: "yapper-ig-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: destination) }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        // -C matches the patterns without case, so `.JSON` comes along too.
        process.arguments = ["-qq", "-o", "-C", archive.path, "*.json", "*.html", "*.htm", "-d", destination.path]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            throw Failure.readFailed
        }
        // unzip exits 11 when a pattern matched nothing, which is fine as long
        // as another did.
        guard [0, 1, 11].contains(process.terminationStatus) else { throw Failure.readFailed }

        var documents: [String: String] = [:]
        var total = 0
        let keys: [URLResourceKey] = [.fileSizeKey, .isRegularFileKey]
        guard let walker = FileManager.default.enumerator(at: destination, includingPropertiesForKeys: keys) else { return [:] }
        let root = destination.standardizedFileURL.path
        for case let url as URL in walker {
            let values = try? url.resourceValues(forKeys: Set(keys))
            guard values?.isRegularFile == true, ["json", "html", "htm"].contains(url.pathExtension.lowercased()) else { continue }
            let bytes = values?.fileSize ?? 0
            guard bytes <= maxDocumentBytes else { continue }
            total += bytes
            guard total <= maxExtractedBytes else { break }
            guard let data = try? Data(contentsOf: url) else { continue }
            var name = url.standardizedFileURL.path
            if name.hasPrefix(root) { name = String(name.dropFirst(root.count + 1)) }
            documents[name] = String(decoding: data, as: UTF8.self)
        }
        return documents
    }
}
