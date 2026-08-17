import Foundation

/// Who refused the request, when the refusal came from in front of the app.
///
/// The hosting edge and the authentication layer both answer before any route
/// runs, and their refusals mean different things from a route's: a rate limit
/// or a bot challenge is not a missing credit. The headers they leave behind
/// are the only way to tell the two apart from a creator's machine, so they
/// travel with the message rather than being dropped on the floor.
enum EdgeRefusalNote {
    private static let headers = [
        "x-vercel-error",
        "x-vercel-mitigated",
        "x-vercel-id",
        "x-clerk-auth-reason",
        "retry-after",
    ]

    static func text(for response: HTTPURLResponse, body: Data = Data()) -> String? {
        var parts = headers.compactMap { header -> String? in
            guard
                let value = response.value(forHTTPHeaderField: header)?
                    .trimmingCharacters(in: .whitespaces),
                !value.isEmpty
            else { return nil }
            return "\(header): \(value)"
        }
        if let said = spoken(body) { parts.append(said) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    /// The first line of what the refusal actually said, with the markup of an
    /// error page stripped out. A hosting platform and a route word a 429 very
    /// differently, and that wording is what says which one answered.
    private static func spoken(_ body: Data) -> String? {
        guard let text = String(data: body.prefix(4_000), encoding: .utf8) else { return nil }
        let stripped = text
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !stripped.isEmpty else { return nil }
        return "said: \(stripped.prefix(180))"
    }
}
