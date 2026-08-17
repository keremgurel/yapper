import Foundation

/// How the app names itself to the backend.
///
/// The embedded web session and the native API calls carry the same token, so
/// the server sees one client rather than a browser and an anonymous uploader.
enum NativeUserAgent {
    static let token: String = {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            ?? "development"
        return "YapperStudioNative/\(version)"
    }()
}
