import AppKit
import Foundation

/// Getting an edit back when its footage has wandered off.
///
/// A project holds paths, so the footage can leave without telling anyone: a
/// card ejected, a drive unplugged, a folder moved or renamed. None of that is a
/// reason to lose the edit, which is why nothing here throws any part of the
/// project away. The clips, the cuts, the captions and the transcript are all
/// still true; only the file behind them is temporarily unreachable.
extension EditorSession {
    /// The media the editor cannot currently read.
    var offlineMedia: [ProjectMedia] { mediaAvailability.offline }

    /// Points a piece of media at the file it has become, and takes everything
    /// else that moved with it.
    ///
    /// Files travel in groups. A card remounted under a new name, a folder
    /// dragged to another disk: whatever the creator located, its neighbours
    /// are almost certainly beside it, and asking for each of them one at a
    /// time would be a chore for something the answer is already known to.
    func relinkMedia(_ media: ProjectMedia, to url: URL) async {
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        let canonical = url.resolvingSymlinksInPath()
        let folder = canonical.deletingLastPathComponent()
        var relinked: [(id: UUID, url: URL)] = [(media.id, canonical)]

        for other in offlineMedia where other.id != media.id {
            let candidate = folder.appending(path: other.url.lastPathComponent)
            guard FileManager.default.fileExists(atPath: candidate.path) else { continue }
            relinked.append((other.id, candidate))
        }

        updateProject { project in
            for (id, url) in relinked {
                guard let index = project.media.firstIndex(where: { $0.id == id }) else { continue }
                CompositionSourceCache.shared.forget(project.media[index].url)
                project.media[index].url = url
                project.media[index].name = url.lastPathComponent
            }
            project.updatedAt = Date()
        }

        // The file that answers to the path now may not be the file that used to,
        // so what the editor believes about its shape and length is re-read
        // rather than assumed. The identifier is kept: every clip, caption and
        // transcript word in the project is hung off it.
        for (id, url) in relinked {
            guard
                let probed = try? await MediaProbe.inspect(url: url),
                let index = project.media.firstIndex(where: { $0.id == id })
            else { continue }
            updateProject { project in
                project.media[index].duration = probed.duration
                project.media[index].width = probed.width
                project.media[index].height = probed.height
                project.media[index].hasAudio = probed.hasAudio
                project.media[index].kind = probed.kind
            }
        }

        refreshMediaAvailability()
        do {
            try await reloadAfterRecovery()
            recordHistory(before: rollbackState.project)
            setStatus(
                relinked.count == 1
                    ? "Reconnected \(media.name)"
                    : "Reconnected \(relinked.count) files"
            )
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
            refreshMediaAvailability()
        }
    }

    func refreshMediaAvailability() {
        mediaAvailability.refresh()
    }

    /// Rebuilds everything that could not be built while the files were away:
    /// the composition, and the thumbnails and waveforms whose earlier attempts
    /// found nothing to read.
    func reloadAfterRecovery() async throws {
        clearError()
        if !project.clips.isEmpty {
            try await rebuildComposition(preserveTime: true)
        }
        for media in project.media { restartDerivedMedia(for: media) }
        try await persist()
        setStatus("Ready")
    }

    /// What the creator is told, and what they can do about it.
    var offlineMediaSummary: String? {
        let offline = offlineMedia
        guard let first = offline.first else { return nil }
        let what = offline.count == 1
            ? first.name
            : "\(offline.count) files, including \(first.name),"
        if let volume = MediaAvailability.volumeName(of: first.url) {
            return "\(what) is on “\(volume)”, which is not connected."
        }
        return "\(what) is not where it was. It may have been moved or renamed."
    }
}

@MainActor
enum RelinkPanel {
    /// Asks for the file, starting in the folder it used to be in, so the
    /// creator lands where they were rather than at the top of their disk.
    static func locate(_ media: ProjectMedia, for session: EditorSession) {
        let panel = NSOpenPanel()
        panel.title = "Locate \(media.name)"
        panel.message = "Find \(media.name). Anything else that moved with it is reconnected too."
        panel.prompt = "Reconnect"
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.directoryURL = media.url.deletingLastPathComponent()
        panel.nameFieldStringValue = media.name
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await session.relinkMedia(media, to: url) }
    }
}
