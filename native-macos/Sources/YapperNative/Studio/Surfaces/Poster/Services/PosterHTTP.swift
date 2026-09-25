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
    /// The video already waiting to be posted, when the refusal is the
    /// one-waiting-video rule (`poster_slot_busy`).
    var waiting: PosterWaitingVideo? = nil

    var errorDescription: String? { message }
}

/// The one video an account may keep stored while it prepares to post.
struct PosterWaitingVideo: Codable, Equatable, Sendable {
    let kind: String
    let id: String
    let title: String?
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
        let payload = try body.map { try JSONSerialization.data(withJSONObject: $0) }
        do {
            return try await APITransport.send(path, method: method) { request in
                for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
                if let payload {
                    request.httpBody = payload
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                }
            }
        } catch let failure as APITransport.Failure {
            throw Self.failure(status: failure.status, body: failure.body)
        }
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
            message: shared.message,
            waiting: (try? JSONDecoder().decode(WaitingEnvelope.self, from: body))?.waiting
        )
    }
}

private struct WaitingEnvelope: Decodable { let waiting: PosterWaitingVideo? }

extension Dictionary where Key == String, Value == Any {
    /// Drops nil values so optional fields are left out, as `JSON.stringify` does.
    static func compact(_ pairs: [String: Any?]) -> [String: Any] {
        pairs.compactMapValues { $0 }
    }
}
