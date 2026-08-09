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

    static func authenticatedRequest(url: URL) async -> URLRequest {
        let cookies = await webSessionCookies()
        let applicableCookies = cookies.filter { cookie in
            cookieApplies(cookie, to: url)
        }
        var request = URLRequest(url: url)
        for (header, value) in HTTPCookie.requestHeaderFields(with: applicableCookies) {
            request.setValue(value, forHTTPHeaderField: header)
        }
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
        let pathMatches = url.path.hasPrefix(cookie.path)
        let securityMatches = !cookie.isSecure || url.scheme?.lowercased() == "https"
        let freshnessMatches = cookie.expiresDate.map { $0 > Date() } ?? true
        return hostMatches && pathMatches && securityMatches && freshnessMatches
    }

    /// What a failed call means to a creator, in their terms. The routes answer
    /// 501 when the server has no model configured and 402 when the account
    /// cannot pay for the pass, and neither is worth showing as a status code.
    static func failure(status: Int, body: Data, action: String) -> NativeEditorError {
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
        if status == 401 || status == 403 {
            return .aiFailed("Sign in from the Cloud Studio tab, then try \(action.lowercased()) again.")
        }
        return .aiFailed("\(action) failed (HTTP \(status)).")
    }
}
