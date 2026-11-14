import AppKit

/// Which storage folders can't be used right now. It checks again whenever a
/// drive mounts, unmounts or is renamed, when a folder is changed, and when
/// the app comes forward, so a USB drive pulled out mid-session is noticed at
/// once rather than at the next failed save.
@MainActor
final class StorageMonitor: ObservableObject {
    static let shared = StorageMonitor()

    @Published private(set) var statuses: [StorageKind: StorageAvailability] = [:]
    /// Bumped whenever a drive or folder changed, so views that list a folder
    /// read it again.
    @Published private(set) var generation = 0

    private let folders: StorageFolders
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []

    init(folders: StorageFolders = .standard) {
        self.folders = folders
        statuses = Self.check(folders)
        let workspace = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.didMountNotification, NSWorkspace.didUnmountNotification, NSWorkspace.didRenameVolumeNotification] {
            observe(workspace, name, changed: true)
        }
        observe(.default, .storageFoldersChanged, changed: true)
        observe(.default, NSApplication.didBecomeActiveNotification, changed: false)
    }

    func status(of kind: StorageKind) -> StorageAvailability {
        statuses[kind] ?? .available
    }

    /// `changed` marks an event that may have changed what a folder holds
    /// even when every folder is still there, like a drive being swapped.
    func refresh(changed: Bool = true) {
        let next = Self.check(folders)
        guard changed || next != statuses else { return }
        statuses = next
        generation += 1
    }

    private static func check(_ folders: StorageFolders) -> [StorageKind: StorageAvailability] {
        Dictionary(uniqueKeysWithValues: StorageKind.allCases.map { ($0, folders.availability(of: $0)) })
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, changed: Bool) {
        let token = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.refresh(changed: changed) }
        }
        observers.append((center, token))
    }
}
