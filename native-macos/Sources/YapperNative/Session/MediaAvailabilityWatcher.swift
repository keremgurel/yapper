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
    @Published private(set) var offlineAssets: [MediaAvailability.OfflineAsset] = []

    var offline: [ProjectMedia] { offlineAssets.compactMap(\.media) }

    private var supply: (() -> EditorProject)?
    /// Called when files that were missing have come back, which is the cue to
    /// rebuild the composition that could not be built without them.
    private var onRestored: (() -> Void)?
    private var onResourcesChanged: (() -> Void)?
    private var identityMismatches: Set<UUID> = []
    private var audioIdentityMismatches: Set<UUID> = []
    private var observers: [NSObjectProtocol] = []

    var isEverythingAvailable: Bool { offlineAssets.isEmpty }
    var requiredOffline: [MediaAvailability.OfflineAsset] { offlineAssets.filter(\.isRequired) }

    func start(
        supplying project: @escaping () -> EditorProject,
        onRestored: @escaping () -> Void,
        onResourcesChanged: @escaping () -> Void
    ) {
        supply = project
        self.onRestored = onRestored
        self.onResourcesChanged = onResourcesChanged
        observe(NSWorkspace.shared.notificationCenter, NSWorkspace.didMountNotification)
        observe(NSWorkspace.shared.notificationCenter, NSWorkspace.didUnmountNotification)
        observe(NotificationCenter.default, NSApplication.didBecomeActiveNotification, checkResources: true)
        refresh()
    }

    /// Re-checks now. Cheap: a handful of stats against the file system.
    func refresh(notifyRestored: Bool = true) {
        guard let supply else { return }
        let supplied = supply()
        let missing = MediaAvailability.offlineAssets(in: supplied)
        let forced = supplied.media.filter { identityMismatches.contains($0.id) }
        var next = missing + forced.compactMap { forcedMedia -> MediaAvailability.OfflineAsset? in
            guard !missing.contains(where: { $0.id == .media(forcedMedia.id) }) else { return nil }
            return .init(
                id: .media(forcedMedia.id), name: forcedMedia.name, url: forcedMedia.url,
                isRequired: MediaAvailability.requiredMediaIDs(in: supplied).contains(forcedMedia.id),
                policy: .visual, media: forcedMedia, audioLayer: nil
            )
        }
        for layer in supplied.audioLayers ?? [] where audioIdentityMismatches.contains(layer.id) {
            guard !next.contains(where: { $0.id == .audio(layer.id) }) else { continue }
            next.append(.init(
                id: .audio(layer.id), name: layer.name, url: layer.url,
                isRequired: MediaAvailability.isRequired(layer, in: supplied),
                policy: layer.builtInID != nil ? .builtInAudio : (layer.sourceKind == .saved ? .savedAudio : .externalAudio),
                media: nil, audioLayer: layer
            ))
        }
        next = MediaAvailability.sorted(next)
        guard next != offlineAssets else { return }
        let previousRequired = Set(offlineAssets.filter(\.isRequired).map(\.id))
        let nextRequired = Set(next.filter(\.isRequired).map(\.id))
        offlineAssets = next
        if !previousRequired.subtracting(nextRequired).isEmpty, notifyRestored { onRestored?() }
    }

    /// A path can come back holding different bytes. Keep that source in the
    /// recovery UI until the creator explicitly resolves the identity mismatch.
    func markOffline(_ media: ProjectMedia) {
        identityMismatches.insert(media.id)
        guard !offlineAssets.contains(where: { $0.id == .media(media.id) }) else { return }
        let project = supply?()
        offlineAssets.append(.init(
            id: .media(media.id), name: media.name, url: media.url,
            isRequired: project?.clips.contains(where: { $0.mediaID == media.id }) == true ||
                (project?.overlays ?? []).contains(where: { $0.mediaID == media.id }),
            policy: .visual, media: media, audioLayer: nil
        ))
        offlineAssets = MediaAvailability.sorted(offlineAssets)
    }

    func clearIdentityMismatch(_ mediaID: UUID) {
        identityMismatches.remove(mediaID)
    }

    func hasIdentityMismatch(_ mediaID: UUID) -> Bool { identityMismatches.contains(mediaID) }

    func markAudioOffline(_ layer: ProjectAudioLayer) {
        audioIdentityMismatches.insert(layer.id)
        guard !offlineAssets.contains(where: { $0.id == .audio(layer.id) }) else { return }
        let project = supply?()
        offlineAssets.append(.init(
            id: .audio(layer.id), name: layer.name, url: layer.url,
            isRequired: project.map { MediaAvailability.isRequired(layer, in: $0) } ?? true,
            policy: layer.builtInID != nil ? .builtInAudio : (layer.sourceKind == .saved ? .savedAudio : .externalAudio),
            media: nil, audioLayer: layer
        ))
        offlineAssets = MediaAvailability.sorted(offlineAssets)
    }

    func clearAudioIdentityMismatch(_ layerID: UUID) {
        audioIdentityMismatches.remove(layerID)
    }

    func hasAudioIdentityMismatch(_ layerID: UUID) -> Bool { audioIdentityMismatches.contains(layerID) }

    private func observe(
        _ center: NotificationCenter,
        _ name: Notification.Name,
        checkResources: Bool = false
    ) {
        let observer = center.addObserver(
            forName: name,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.refresh()
                if checkResources { self?.onResourcesChanged?() }
            }
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
