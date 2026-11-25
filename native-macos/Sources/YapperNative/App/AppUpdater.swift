import Combine
import Foundation
import Sparkle

/// Keeps the installed app current with Sparkle.
///
/// Sparkle reads the feed address and the EdDSA public key from Info.plist,
/// checks once a day on its own, and verifies each download against that key
/// before installing it. A build run with `swift run` has no app bundle around
/// it, so there is nothing to replace and the updater never starts.
@MainActor
final class AppUpdater: ObservableObject {
    static let shared = AppUpdater()

    /// False while a check is already showing, and always false for a build
    /// that cannot update itself.
    @Published private(set) var canCheckForUpdates = false

    private var controller: SPUStandardUpdaterController?

    private init() {}

    func start() {
        guard controller == nil, Self.isUpdatableBuild(Bundle.main) else { return }
        let controller = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
        controller.updater.publisher(for: \.canCheckForUpdates)
            .receive(on: RunLoop.main)
            .assign(to: &$canCheckForUpdates)
        self.controller = controller
    }

    func checkForUpdates() {
        controller?.checkForUpdates(nil)
    }

    /// Only a packaged app that names a feed and a key can update itself.
    nonisolated static func isUpdatableBuild(_ bundle: Bundle) -> Bool {
        guard bundle.bundleURL.pathExtension == "app" else { return false }
        let feed = bundle.object(forInfoDictionaryKey: "SUFeedURL") as? String ?? ""
        let key = bundle.object(forInfoDictionaryKey: "SUPublicEDKey") as? String ?? ""
        return !feed.isEmpty && !key.isEmpty
    }
}
