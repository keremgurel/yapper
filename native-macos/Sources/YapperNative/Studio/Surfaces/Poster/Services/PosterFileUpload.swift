import Foundation

/// Puts a local file into the creator's storage through a presigned URL,
/// reporting real progress so a large export never looks frozen.
enum PosterFileUpload {
    enum Purpose: String { case recording, thumbnail }

    /// Asks for a presigned PUT. Maps the route's refusals to upload codes.
    static func ticket(bytes: Int, mimeType: String, ext: String, purpose: Purpose) async throws -> PosterUploadTicket {
        do {
            return try await PosterHTTP.post("api/media/upload-url", body: [
                "sizeBytes": bytes, "mimeType": mimeType, "ext": ext, "purpose": purpose.rawValue,
            ])
        } catch let error as PosterHTTPError {
            switch error.code {
            case "not_entitled": throw PosterUploadFailure("locked")
            case "storage_full": throw PosterUploadFailure("storage_full")
            case "media_too_large": throw PosterUploadFailure("too_large")
            case "poster_slot_busy": throw PosterUploadFailure("slot_busy", waiting: error.waiting)
            default: throw PosterUploadFailure("failed")
            }
        }
    }

    static func put(file: URL, to url: URL, mimeType: String, progress: @escaping @Sendable (Double) -> Void) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        let delegate = ProgressDelegate(progress)
        let response: URLResponse
        do {
            (_, response) = try await URLSession.shared.upload(for: request, fromFile: file, delegate: delegate)
        } catch {
            throw PosterUploadFailure("network")
        }
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            throw PosterUploadFailure("failed")
        }
        progress(1)
    }

    static func put(data: Data, to url: URL, mimeType: String) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, from: data)
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            throw PosterUploadFailure("failed")
        }
    }

    /// Uploads a rendered cover and returns its storage key.
    static func uploadCover(png: Data) async throws -> String {
        let ticket = try await ticket(bytes: png.count, mimeType: "image/png", ext: "png", purpose: .thumbnail)
        guard let url = URL(string: ticket.url) else { throw PosterUploadFailure("failed") }
        try await put(data: png, to: url, mimeType: "image/png")
        return ticket.key
    }

    private final class ProgressDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
        let report: @Sendable (Double) -> Void
        init(_ report: @escaping @Sendable (Double) -> Void) { self.report = report }

        func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64,
                        totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
            guard totalBytesExpectedToSend > 0 else { return }
            report(min(1, Double(totalBytesSent) / Double(totalBytesExpectedToSend)))
        }
    }
}

/// An upload that stopped, by the code `PosterErrorCopy.upload` reads.
struct PosterUploadFailure: Error {
    let code: String
    var waiting: PosterWaitingVideo?
    init(_ code: String, waiting: PosterWaitingVideo? = nil) {
        self.code = code
        self.waiting = waiting
    }
}
