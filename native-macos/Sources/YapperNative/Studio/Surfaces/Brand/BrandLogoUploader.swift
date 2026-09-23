import Foundation
import UniformTypeIdentifiers

struct BrandLogoUploadError: Error, Equatable {
    let message: String
}

/// Uploads one logo file the way the web does: ask for a presigned URL,
/// PUT the bytes straight to storage, then register the object as a logo.
enum BrandLogoUploader {
    static let acceptedTypes: [UTType] = [.png, .jpeg, .webP, .svg]

    /// The mime type the routes accept for this file, or nil.
    static func mimeType(for url: URL) -> String? {
        guard let type = UTType(filenameExtension: url.pathExtension.lowercased()) else { return nil }
        if type.conforms(to: .svg) { return "image/svg+xml" }
        if type.conforms(to: .png) { return "image/png" }
        if type.conforms(to: .jpeg) { return "image/jpeg" }
        if type.conforms(to: .webP) { return "image/webp" }
        return nil
    }

    private struct TicketRequest: Encodable {
        let sizeBytes: Int
        let mimeType: String
        let ext: String
        let purpose = "brand_logo"
    }

    private struct Register: Encodable {
        let mediaKey: String
        let mimeType: String
        let name: String
    }

    static func upload(_ file: URL) async throws -> BrandLogo {
        guard let mimeType = mimeType(for: file) else {
            throw BrandLogoUploadError(message: "Use a PNG, JPG, WebP, or SVG logo.")
        }
        let data = try Data(contentsOf: file)
        guard !data.isEmpty, data.count <= BrandLimits.maxLogoBytes else {
            throw BrandLogoUploadError(message: data.isEmpty ? "That file is empty." : "Logos must be smaller than 5 MB.")
        }
        let ext = mimeType == "image/svg+xml" ? "svg" : String(mimeType.split(separator: "/").last ?? "png")
        let ticket: BrandUploadTicket = try await StudioJSONClient.post(
            "api/media/upload-url",
            body: TicketRequest(sizeBytes: data.count, mimeType: mimeType, ext: ext)
        )
        guard let target = URL(string: ticket.url) else { throw BrandLogoUploadError(message: BrandErrorMessage.fallback) }
        var put = URLRequest(url: target)
        put.httpMethod = "PUT"
        put.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: put, from: data)
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            throw BrandLogoUploadError(message: "The logo didn't upload. Check your connection and try again.")
        }
        let envelope: BrandLogoEnvelope = try await StudioJSONClient.post(
            "api/brand/logos",
            body: Register(mediaKey: ticket.key, mimeType: mimeType, name: file.lastPathComponent)
        )
        return envelope.logo
    }
}
