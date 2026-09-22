import Foundation

/// A failed Studio API call, in the creator's terms.
struct StudioAPIError: LocalizedError, Equatable {
    let status: Int
    let code: String?
    let message: String

    var errorDescription: String? { message }

    /// Clerk answers a protected route with 404 when the session is gone.
    var isSignedOut: Bool { status == 401 || status == 403 || status == 404 && code == nil }
}

/// JSON calls to the ypr.app API from native Studio pages.
///
/// Every request carries the web session's cookies and token through
/// `YapperAPI.authenticatedRequest`, so a native page can call the same
/// routes the web page did with no backend change. Bodies and replies are
/// the routes' own camelCase JSON.
enum StudioJSONClient {
    static let decoder: JSONDecoder = JSONDecoder()
    static let encoder: JSONEncoder = JSONEncoder()

    static func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try await send(path, method: "GET", body: Optional<Empty>.none)
    }

    static func post<T: Decodable, B: Encodable>(
        _ path: String, body: B, as type: T.Type = T.self
    ) async throws -> T {
        try await send(path, method: "POST", body: body)
    }

    static func patch<T: Decodable, B: Encodable>(
        _ path: String, body: B, as type: T.Type = T.self
    ) async throws -> T {
        try await send(path, method: "PATCH", body: body)
    }

    static func put<T: Decodable, B: Encodable>(
        _ path: String, body: B, as type: T.Type = T.self
    ) async throws -> T {
        try await send(path, method: "PUT", body: body)
    }

    @discardableResult
    static func delete(_ path: String) async throws -> Data {
        try await raw(path, method: "DELETE", body: nil)
    }

    /// For routes whose reply the caller reads by hand, or ignores.
    @discardableResult
    static func raw(_ path: String, method: String, body: Data?, contentType: String = "application/json") async throws -> Data {
        var request = await YapperAPI.authenticatedRequest(url: url(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw failure(status: status, body: data)
        }
        return data
    }

    private struct Empty: Encodable {}

    private static func send<T: Decodable, B: Encodable>(
        _ path: String, method: String, body: B?
    ) async throws -> T {
        let payload = try body.map { try encoder.encode($0) }
        let data = try await raw(path, method: method, body: payload)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw StudioAPIError(status: 200, code: "decode", message: "Studio sent something this version of the app can't read. Update the app and try again.")
        }
    }

    static func url(_ path: String) -> URL {
        // Paths come with their own query strings, which `appending(path:)`
        // would escape, so the URL is built from the string.
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return URL(string: "\(YapperAPI.baseURL.absoluteString)/\(trimmed)")!
    }

    static func failure(status: Int, body: Data) -> StudioAPIError {
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        let code = json?["error"] as? String
        let message: String
        switch status {
        case 401, 403:
            message = "Your Yapper session expired. Sign in again to continue."
        case 404 where code == nil:
            message = "Your Yapper session expired. Sign in again to continue."
        case 404:
            message = "That isn't there anymore. It may have been deleted."
        case 402:
            message = code == "not_entitled" ? "This needs an active Yapper subscription." : "You're out of credits. Top up to keep going."
        case 429:
            message = "That's as many requests as this hour allows. Try again in a bit."
        case 500...:
            message = "Studio couldn't finish that. Nothing was lost; try again."
        default:
            message = (json?["message"] as? String) ?? "That didn't work. Try again."
        }
        if status == 401 || status == 403 || (status == 404 && code == nil) {
            Task { @MainActor in StudioAuth.shared.requireSignIn() }
        }
        return StudioAPIError(status: status, code: code, message: message)
    }
}
