import Foundation

/// A POST that may take minutes: reading a whole document, or listening to a
/// long video. The shared client uses the system's one minute timeout, which
/// these routes are allowed to outlast, so this one sets its own and reuses
/// the client's auth, URL and error handling.
enum BrainLongRequest {
    static func post<T: Decodable>(
        _ path: String,
        body: some Encodable,
        timeout: TimeInterval,
        as type: T.Type = T.self
    ) async throws -> T {
        let payload = try StudioJSONClient.encoder.encode(body)
        let data: Data
        do {
            data = try await APITransport.send(path, method: "POST") { request in
                request.timeoutInterval = timeout
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = payload
            }
        } catch let failure as APITransport.Failure {
            throw StudioJSONClient.failure(status: failure.status, body: failure.body)
        }
        do {
            return try StudioJSONClient.decoder.decode(T.self, from: data)
        } catch {
            throw StudioAPIError(status: 200, code: "decode", message: "Studio sent something this version of the app can't read. Update the app and try again.")
        }
    }
}
