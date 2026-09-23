import Foundation

/// A failed Poster call that keeps the route's own codes, because publishing
/// branches on them (`reason`, `reconcilable`) where other pages only show a
/// message.
struct PosterHTTPError: LocalizedError {
    let status: Int
    let code: String?
    let reason: String?
    let detail: String?
    let reconcilable: Bool
    let message: String

    var errorDescription: String? { message }
}

/// JSON calls with the extra headers publishing needs (an Idempotency-Key),
/// on the same signed-in request `StudioJSONClient` uses.
enum PosterHTTP {
    nonisolated(nonsending) static func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try decode(await send(path, method: "GET", body: nil))
    }

    nonisolated(nonsending) static func post<T: Decodable>(
        _ path: String, body: [String: Any], headers: [String: String] = [:], as type: T.Type = T.self
    ) async throws -> T {
        try decode(await send(path, method: "POST", body: body, headers: headers))
    }

    nonisolated(nonsending) static func patch<T: Decodable>(_ path: String, body: [String: Any], as type: T.Type = T.self) async throws -> T {
        try decode(await send(path, method: "PATCH", body: body))
    }

    nonisolated(nonsending) static func send(
        _ path: String, method: String, body: [String: Any]?, headers: [String: String] = [:]
    ) async throws -> Data {
        var request = await YapperAPI.authenticatedRequest(url: StudioJSONClient.url(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw failure(status: status, body: data) }
        return data
    }

    /// Raw bytes from a signed-in GET, for images served by our own routes.
    nonisolated(nonsending) static func bytes(_ path: String) async throws -> Data {
        try await send(path, method: "GET", body: nil)
    }

    static func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw PosterHTTPError(status: 200, code: "decode", reason: nil, detail: nil, reconcilable: false,
                                  message: "Studio sent something this version of the app can't read. Update the app and try again.")
        }
    }

    static func failure(status: Int, body: Data) -> PosterHTTPError {
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        let shared = StudioJSONClient.failure(status: status, body: body)
        return PosterHTTPError(
            status: status,
            code: json?["error"] as? String,
            reason: json?["reason"] as? String,
            detail: json?["message"] as? String,
            reconcilable: json?["reconcilable"] as? Bool ?? false,
            message: shared.message
        )
    }
}

extension Dictionary where Key == String, Value == Any {
    /// Drops nil values so optional fields are left out, as `JSON.stringify` does.
    static func compact(_ pairs: [String: Any?]) -> [String: Any] {
        pairs.compactMapValues { $0 }
    }
}
