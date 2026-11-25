import SwiftUI

/// The "Check for Updates…" item, placed under the app menu.
///
/// A view rather than a bare button so it observes the updater and greys out
/// while a check is already on screen.
struct CheckForUpdatesCommand: View {
    @ObservedObject var updater: AppUpdater

    var body: some View {
        Button("Check for Updates…") { updater.checkForUpdates() }
            .disabled(!updater.canCheckForUpdates)
    }
}
