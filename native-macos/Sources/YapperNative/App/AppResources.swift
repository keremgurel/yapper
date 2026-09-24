import Foundation

/// The bundle that holds the app's sounds and icons.
///
/// SwiftPM's generated `Bundle.module` looks next to the app bundle and then
/// in the folder the app was compiled in, and traps when neither exists. The
/// packaged app keeps the bundle in Contents/Resources, so an installed build
/// crashed at launch as soon as its build folder was gone. This looks there
/// first and never traps.
enum AppResources {
    private final class Token {}

    static let bundle: Bundle? = {
        let name = "YapperNative_YapperNative.bundle"
        let candidates = [
            Bundle.main.resourceURL?.appending(path: name),
            Bundle.main.bundleURL.appending(path: name),
            Bundle.main.executableURL?.deletingLastPathComponent().appending(path: name),
            // Tests: the code's own bundle sits beside the resource bundle.
            Bundle(for: Token.self).bundleURL.deletingLastPathComponent().appending(path: name),
        ]
        for case let url? in candidates {
            if let bundle = Bundle(url: url) { return bundle }
        }
        return nil
    }()

    static func url(forResource name: String, withExtension ext: String, subdirectory: String) -> URL? {
        bundle?.url(forResource: name, withExtension: ext, subdirectory: subdirectory)
    }
}
