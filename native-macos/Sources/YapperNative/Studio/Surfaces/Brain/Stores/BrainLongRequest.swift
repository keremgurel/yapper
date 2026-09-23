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
        var request = await YapperAPI.authenticatedRequest(url: StudioJSONClient.url(path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try StudioJSONClient.encoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw StudioJSONClient.failure(status: status, body: data)
        }
        do {
            return try StudioJSONClient.decoder.decode(T.self, from: data)
        } catch {
            throw StudioAPIError(status: 200, code: "decode", message: "Studio sent something this version of the app can't read. Update the app and try again.")
        }
    }
}
