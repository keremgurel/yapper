import Foundation
import Testing
@testable import YapperNative

/// The updater starts only in a packaged app that names a feed and a key.
/// A `swift run` build has nothing to replace, and a bundle missing either
/// key would show Sparkle's configuration error at every launch.
struct AppUpdaterTests {
    @Test func packagedAppWithFeedAndKeyUpdates() throws {
        let bundle = try makeBundle(extension: "app", feed: "https://example.com/appcast.xml", key: "abc=")
        #expect(AppUpdater.isUpdatableBuild(bundle))
    }

    @Test func bareExecutableDoesNotUpdate() throws {
        let bundle = try makeBundle(extension: "", feed: "https://example.com/appcast.xml", key: "abc=")
        #expect(!AppUpdater.isUpdatableBuild(bundle))
    }

    @Test func missingKeyDoesNotUpdate() throws {
        let bundle = try makeBundle(extension: "app", feed: "https://example.com/appcast.xml", key: nil)
        #expect(!AppUpdater.isUpdatableBuild(bundle))
    }

    @Test func missingFeedDoesNotUpdate() throws {
        let bundle = try makeBundle(extension: "app", feed: nil, key: "abc=")
        #expect(!AppUpdater.isUpdatableBuild(bundle))
    }

    @Test func shippedInfoPlistNamesFeedAndKey() throws {
        let plist = URL(filePath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appending(path: "Resources/Info.plist")
        let info = try #require(NSDictionary(contentsOf: plist) as? [String: Any])
        let feed = try #require(info["SUFeedURL"] as? String)
        #expect(feed.hasPrefix("https://"))
        #expect(!(info["SUPublicEDKey"] as? String ?? "").isEmpty)
    }

    private func makeBundle(extension pathExtension: String, feed: String?, key: String?) throws -> Bundle {
        let name = pathExtension.isEmpty ? "Updater-\(UUID())" : "Updater-\(UUID()).\(pathExtension)"
        let root = FileManager.default.temporaryDirectory.appending(path: name, directoryHint: .isDirectory)
        let contents = root.appending(path: "Contents", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: contents, withIntermediateDirectories: true)
        var info: [String: Any] = ["CFBundleIdentifier": "com.example.updater.\(UUID())"]
        info["SUFeedURL"] = feed
        info["SUPublicEDKey"] = key
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try data.write(to: contents.appending(path: "Info.plist"))
        return try #require(Bundle(url: root))
    }
}
