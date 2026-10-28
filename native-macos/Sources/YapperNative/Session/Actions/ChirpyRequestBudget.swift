import Foundation

/// Keeps a planning request inside what the endpoint accepts. When a request
/// is over, the selected overlay's image goes first: it only helps masking and
/// framing requests, and without it the planner asks for a manual selection
/// instead of failing the whole request.
enum ChirpyRequestBudget {
    static let maxBytes = 512 * 1024

    static func encode(_ body: [String: ActionJSON]) throws -> Data {
        let data = try JSONEncoder().encode(body)
        guard data.count > maxBytes else { return data }
        guard case .object(var context)? = body["context"], let image = context["selectedOverlayImage"], image != .null else {
            throw tooLarge
        }
        context["selectedOverlayImage"] = .null
        var trimmed = body
        trimmed["context"] = .object(context)
        let smaller = try JSONEncoder().encode(trimmed)
        guard smaller.count <= maxBytes else { throw tooLarge }
        return smaller
    }

    private static let tooLarge = AppActionError("This project is too large for Chirpy’s current context limit.")
}
