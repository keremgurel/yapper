import Foundation

/// Only a completed provider callback on a trusted Studio URL ends sign-in.
enum ConnectionOAuthReturn {
    static func matches(_ url: URL) -> Bool {
        guard url.scheme == "https",
              ["ypr.app", "www.ypr.app", "studio.ypr.app"].contains(url.host ?? ""),
              ["/studio/connections", "/connections"].contains(url.path)
        else { return false }
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return query.contains { $0.name == "connected" || $0.name == "connect_error" }
    }
}
