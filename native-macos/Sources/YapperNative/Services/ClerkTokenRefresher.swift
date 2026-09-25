import Foundation
@preconcurrency import WebKit

/// Mints a Clerk session token straight from Clerk's Frontend API, the same
/// call clerk-js makes, using the session cookies the hidden web page already
/// holds.
///
/// Right after launch the page is still downloading and starting clerk-js, and
/// every API request used to wait on it, measured at almost seven seconds.
/// This takes one round trip. When it cannot (no Clerk cookie yet, a signed
/// out client, Clerk answering something unexpected) it returns nil and the
/// caller falls back to asking the page, exactly as before.
enum ClerkTokenRefresher {
    struct Minted: Decodable { let jwt: String }

    static func mint() async -> String? {
        let started = ContinuousClock.now
        let cookies = await webCookies()
        // Clerk keeps its client cookie on its own domain (the Frontend API
        // host); finding it tells us where to ask.
        guard let client = cookies.first(where: { $0.name == "__client" }),
              let sessionID = sessionID(in: cookies)
        else {
            PerfLog.logger.debug("clerk mint skipped: no client or session cookie")
            return nil
        }
        let host = client.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        guard let url = URL(string: "https://\(host)/v1/client/sessions/\(sessionID)/tokens") else { return nil }

        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(YapperAPI.baseURL.absoluteString, forHTTPHeaderField: "Origin")
        let applicable = cookies.filter { YapperAPI.cookieApplies($0, to: url) }
        for (header, value) in HTTPCookie.requestHeaderFields(with: applicable) {
            request.setValue(value, forHTTPHeaderField: header)
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let minted = try? JSONDecoder().decode(Minted.self, from: data),
              !minted.jwt.isEmpty
        else {
            PerfLog.logger.debug("clerk mint failed after \(PerfLog.milliseconds(since: started))ms")
            return nil
        }
        PerfLog.logger.debug("clerk mint \(PerfLog.milliseconds(since: started))ms")
        return minted.jwt
    }

    /// The active session's id, read from the `sid` claim of the last session
    /// token, which stays readable after the token itself has expired.
    static func sessionID(in cookies: [HTTPCookie]) -> String? {
        let tokens = cookies
            .filter { $0.name == "__session" || $0.name.hasPrefix("__session_") }
            .sorted { ($0.expiresDate ?? .distantPast) > ($1.expiresDate ?? .distantPast) }
        for cookie in tokens {
            if let sid = claim("sid", inJWT: cookie.value) { return sid }
        }
        return nil
    }

    static func claim(_ name: String, inJWT jwt: String) -> String? {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return object[name] as? String
    }

    @MainActor
    private static func webCookies() async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { continuation.resume(returning: $0) }
        }
    }
}
