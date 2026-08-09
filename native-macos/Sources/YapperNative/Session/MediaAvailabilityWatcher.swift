@preconcurrency import AppKit
import Combine
import Foundation

/// Watches whether the project's files are still reachable, and says when the
/// answer changes.
///
/// Checked on the events that actually change the answer rather than on a
/// timer: a volume mounting or unmounting is precisely an SD card going in or
/// coming out, and coming back to the app covers a file moved behind its back.
/// A poll would be both slower to notice and busy forever for an answer that
/// changes twice a day.
///
/// Published on its own so a card being pulled redraws the banner and nothing
/// else.
@MainActor
final class MediaAvailabilityWatcher: ObservableObject {
    /// The media whose files are not where the project left them.
    @Published private(set) var offline: [ProjectMedia] = []

    private var supply: (() -> [ProjectMedia])?
    /// Called when files that were missing have come back, which is the cue to
    /// rebuild the composition that could not be built without them.
    private var onRestored: (() -> Void)?
    private var observers: [NSObjectProtocol] = []

    var isEverythingAvailable: Bool { offline.isEmpty }

    func start(
        supplying media: @escaping () -> [ProjectMedia],
        onRestored: @escaping () -> Void
    ) {
        supply = media
        self.onRestored = onRestored
        observe(NSWorkspace.shared.notificationCenter, NSWorkspace.didMountNotification)
        observe(NSWorkspace.shared.notificationCenter, NSWorkspace.didUnmountNotification)
        observe(NotificationCenter.default, NSApplication.didBecomeActiveNotification)
        refresh()
    }

    /// Re-checks now. Cheap: a handful of stats against the file system.
    func refresh() {
        guard let supply else { return }
        let next = MediaAvailability.missing(in: supply())
        guard next.map(\.id) != offline.map(\.id) else { return }
        let cameBack = !offline.isEmpty && next.isEmpty
        offline = next
        if cameBack { onRestored?() }
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name) {
        let observer = center.addObserver(
            forName: name,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.refresh() }
        }
        observers.append(observer)
    }

    deinit {
        // Torn down by hand: these are block-based observers, which are not
        // removed for you.
        let center = NotificationCenter.default
        let workspace = NSWorkspace.shared.notificationCenter
        for observer in observers {
            center.removeObserver(observer)
            workspace.removeObserver(observer)
        }
    }
}
