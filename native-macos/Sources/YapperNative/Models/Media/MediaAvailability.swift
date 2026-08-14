import Foundation

/// Which of a project's files are still where the project left them.
///
/// A project holds paths, not footage, so a video can walk out from under an
/// open edit: an SD card ejected, a drive unplugged, a folder moved. Everything
/// downstream keeps working on a project that describes a video nobody can read,
/// and the only symptom is a preview that goes black. This is how the editor
/// finds out, so it can say so.
enum MediaAvailability {
    enum RecoveryPolicy: Equatable, Sendable {
        case visual
        case externalAudio
        case savedAudio
        case builtInAudio
    }

    struct OfflineAsset: Identifiable, Equatable, Sendable {
        enum Identity: Hashable, Sendable {
            case media(UUID)
            case audio(UUID)
        }

        let id: Identity
        let name: String
        let url: URL
        let isRequired: Bool
        let policy: RecoveryPolicy
        let media: ProjectMedia?
        let audioLayer: ProjectAudioLayer?
    }

    static func sorted(_ assets: [OfflineAsset]) -> [OfflineAsset] {
        assets.sorted { lhs, rhs in
            if lhs.isRequired != rhs.isRequired { return lhs.isRequired && !rhs.isRequired }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    static func isRegularReadableFile(_ url: URL) -> Bool {
        guard FileManager.default.isReadableFile(atPath: url.path),
              let values = try? url.resourceValues(forKeys: [.isRegularFileKey]),
              values.isRegularFile == true
        else { return false }
        return true
    }

    static func offlineAssets(
        in project: EditorProject,
        available: (URL) -> Bool = isRegularReadableFile,
        bundledAudioURL: (String) -> URL? = { id in
            guard let effect = SoundEffectDescriptor.library.first(where: { $0.id == id }) else { return nil }
            return SoundEffectService.shared.bundledURL(for: effect)
        }
    ) -> [OfflineAsset] {
        let requiredMediaIDs = requiredMediaIDs(in: project)
        let visual = project.media.compactMap { media -> OfflineAsset? in
            guard !available(media.url) else { return nil }
            return OfflineAsset(
                id: .media(media.id),
                name: media.name,
                url: media.url,
                isRequired: requiredMediaIDs.contains(media.id),
                policy: .visual,
                media: media,
                audioLayer: nil
            )
        }
        let libraryPath = AudioLibraryFolder.directory.standardizedFileURL.path + "/"
        let audio = (project.audioLayers ?? []).compactMap { layer -> OfflineAsset? in
            let policy: RecoveryPolicy
            let replacementIsAvailable: Bool
            if let builtInID = layer.builtInID {
                policy = .builtInAudio
                replacementIsAvailable = bundledAudioURL(builtInID).map(available) == true
            } else if layer.sourceKind == .saved || layer.savedAudioID != nil ||
                        layer.url.standardizedFileURL.path.hasPrefix(libraryPath) {
                policy = .savedAudio
                replacementIsAvailable = false
            } else {
                policy = .externalAudio
                replacementIsAvailable = false
            }
            let sourceAvailable = layer.builtInID == nil ? available(layer.url) : replacementIsAvailable
            guard isRequired(layer, in: project), !sourceAvailable else { return nil }
            return OfflineAsset(
                id: .audio(layer.id),
                name: layer.name,
                url: layer.url,
                isRequired: true,
                policy: policy,
                media: nil,
                audioLayer: layer
            )
        }
        return sorted(visual + audio)
    }

    static func requiredMediaIDs(in project: EditorProject) -> Set<UUID> {
        let end = project.duration
        let overlays = (project.overlays ?? []).filter {
            $0.isVisible && $0.duration > 0 && $0.timelineStart < end && $0.timelineStart + $0.duration > 0
        }
        return Set(project.clips.map(\.mediaID) + overlays.map(\.mediaID))
    }

    static func isRequired(_ layer: ProjectAudioLayer, in project: EditorProject) -> Bool {
        let visibleStart = max(0, layer.timelineStart)
        let visibleEnd = min(project.duration, layer.timelineStart + layer.duration)
        guard layer.duration > 0, visibleEnd > visibleStart else { return false }
        if let sourceDuration = layer.sourceDuration {
            return sourceDuration - max(0, layer.sourceStart) > 0
        }
        return true
    }

    /// The media whose files are not there. Pure, and the check is injected, so
    /// the answer can be tested without unplugging anything.
    static func missing(
        in media: [ProjectMedia],
        exists: (URL) -> Bool = isRegularReadableFile
    ) -> [ProjectMedia] {
        media.filter { !exists($0.url) }
    }

    /// The name of the removable volume a file lived on, when it lived on one.
    ///
    /// Worth the trouble because "reconnect G MicroSD" is a thing the creator
    /// can act on, where a path they have to read to the end is not.
    static func volumeName(of url: URL) -> String? {
        let parts = url.pathComponents
        guard parts.count > 2, parts[1] == "Volumes" else { return nil }
        return parts[2]
    }
}
