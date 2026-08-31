import Foundation
@preconcurrency import WebKit

/// The app's line to the Yapper backend.
///
/// The account session lives in the embedded Cloud Studio WKWebView, while
/// native calls use URLSession. Those cookie stores are separate, so every
/// request explicitly carries only the cookies valid for its own URL. This
/// keeps Clerk authentication on native AI calls without exposing an
/// unauthenticated server route or embedding a long-lived secret in the app.
enum YapperAPI {
    static let baseURL = URL(string: "https://ypr.app")!

    static func url(path: String) -> URL {
        baseURL.appending(path: path)
    }

    /// Whether the web session has a Clerk session cookie to send.
    ///
    /// Checked before a long job rather than discovered at the end of one: the
    /// AI edit transcribes first, and finding out it was signed out after
    /// uploading every chunk wastes a minute of the creator's time.
    static func hasSession() async -> Bool {
        // Asked about a real request URL rather than the bare host, so the
        // answer is the same one the request itself will get.
        let target = url(path: "api/transcribe")
        let cookies = await webSessionCookies()
        if cookies.contains(where: { cookie in
            cookie.name.hasPrefix("__session") && cookieApplies(cookie, to: target)
        }) {
            return true
        }
        return await StudioWebCommands.shared.sessionToken() != nil
    }

    static func authenticatedRequest(url: URL) async -> URLRequest {
        let cookies = await webSessionCookies()
        let applicableCookies = cookies.filter { cookie in
            cookieApplies(cookie, to: url)
        }
        var request = URLRequest(url: url)
        for (header, value) in HTTPCookie.requestHeaderFields(with: applicableCookies) {
            request.setValue(value, forHTTPHeaderField: header)
        }
        // A freshly minted bearer token is authoritative when the short-lived
        // cookie has not refreshed yet. Keep cookies too: they are the cheap,
        // established path and cover older Clerk clients.
        if let token = await StudioWebCommands.shared.sessionToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        // The same name the web session uses. An unnamed URLSession posting
        // megabytes of audio is exactly the traffic an edge bot filter is built
        // to stop, and the server already knows this client by this token.
        request.setValue(NativeUserAgent.token, forHTTPHeaderField: "User-Agent")
        return request
    }

    @MainActor
    private static func webSessionCookies() async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies {
                continuation.resume(returning: $0)
            }
        }
    }

    static func cookieApplies(_ cookie: HTTPCookie, to url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let hostMatches = host == domain || host.hasSuffix("." + domain)
        // A URL with nothing after the host has an empty path, and an empty
        // string starts with nothing, not even "/". Read as written, that says
        // a site-wide cookie does not apply to the site's own root, which is
        // how a valid session came back as "signed out".
        let path = url.path.isEmpty ? "/" : url.path
        let pathMatches = path.hasPrefix(cookie.path)
        let securityMatches = !cookie.isSecure || url.scheme?.lowercased() == "https"
        let freshnessMatches = cookie.expiresDate.map { $0 > Date() } ?? true
        return hostMatches && pathMatches && securityMatches && freshnessMatches
    }

    /// What a failed call means to a creator, in their terms. The routes answer
    /// 501 when the server has no model configured and 402 when the account
    /// cannot pay for the pass, and neither is worth showing as a status code.
    ///
    /// - Parameter note: what the edge said about the refusal, when the refusal
    ///   came from in front of the routes. Carried through because "HTTP 429"
    ///   alone cannot tell a rate limit from a bot challenge.
    static func failure(
        status: Int,
        body: Data,
        action: String,
        note: String? = nil
    ) -> NativeEditorError {
        let detail = note.map { " (\($0))" } ?? ""
        if status == 429 {
            return .aiFailed(
                "\(action) was rate limited by the server. Wait a minute, then try again.\(detail)"
            )
        }
        if status == 501 {
            return .aiFailed("The AI editor is not configured on the server.")
        }
        if status == 402 {
            let code = (try? JSONSerialization.jsonObject(with: body) as? [String: Any])?
                .flatMap { $0["error"] as? String }
            if code == "not_entitled" {
                return .aiFailed("\(action) needs an active Yapper subscription.")
            }
            return .aiFailed("\(action) needs more Yapper credits.")
        }
        // 404 belongs here, strange as it looks. Clerk's `auth.protect()`
        // answers a protected API route with 404 rather than 401 when the
        // caller has no session, deliberately, so nobody can enumerate which
        // routes exist. From the app's side an expired session and a missing
        // route are the same status, and one of those is the creator's to fix.
        if status == 401 || status == 403 || status == 404 {
            Task { @MainActor in StudioAuth.shared.requireSignIn() }
            return .aiFailed(
                "Your Yapper session expired. Sign in to continue; your project is saved."
            )
        }
        // A bare status tells a creator nothing they can act on. The routes
        // all answer with a reason; carry it.
        if let reason = (try? JSONSerialization.jsonObject(with: body) as? [String: Any])?
            .flatMap({ $0["error"] as? String }),
            !reason.isEmpty
        {
            return .aiFailed("\(action) failed: \(readable(reason)).\(detail)")
        }
        return .aiFailed("\(action) failed (HTTP \(status)).\(detail)")
    }

    /// The server's own word for what went wrong, in the creator's language.
    private static func readable(_ code: String) -> String {
        switch code {
        case "unsafe_alignment":
            return "the cleaned script could not be matched back to the recording safely, "
                + "so nothing was cut rather than cutting the wrong thing"
        case "no_provider":
            return "the AI editor is not configured on the server"
        case "rate_limited":
            return "you have run as many AI edits as this hour allows"
        case "timeout":
            return "the model took too long"
        case "aborted":
            return "the request was cancelled"
        default:
            return code.replacingOccurrences(of: "_", with: " ")
        }
    }
}
