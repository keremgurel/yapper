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
    func relinkMedia(
        _ media: ProjectMedia,
        to url: URL,
        allowUnverifiedPrimary: Bool = false
    ) async {
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        clearError()
        let canonical = url.resolvingSymlinksInPath()
        let folder = canonical.deletingLastPathComponent()
        var didMutate = false
        do {
            guard let currentMedia = rollbackState.project.media.first(where: { $0.id == media.id }) else {
                throw NativeEditorError.missingMedia(media.id)
            }
            // Probe everything before publishing any new path. The explicitly
            // chosen file must be a compatible source; same-name neighbours are
            // a convenience and are simply skipped when they do not validate.
            let primary = try await stagedRelink(
                currentMedia,
                to: canonical,
                allowWeakMatch: allowUnverifiedPrimary
            )
            var staged = [primary]
            for other in rollbackState.project.media where
                other.id != currentMedia.id && !FileManager.default.fileExists(atPath: other.url.path)
            {
                let candidate = folder.appending(path: other.url.lastPathComponent)
                guard FileManager.default.fileExists(atPath: candidate.path),
                      let replacement = try? await stagedRelink(other, to: candidate, allowWeakMatch: false)
                else { continue }
                staged.append(replacement)
            }

            updateProject { project in
                for replacement in staged {
                    guard let index = project.media.firstIndex(where: { $0.id == replacement.id }) else {
                        continue
                    }
                    CompositionSourceCache.shared.forget(project.media[index].url)
                    project.media[index] = replacement
                }
                project.updatedAt = Date()
            }
            didMutate = true
            try await reloadAfterRecovery(restartDerived: false)
            await reconcileDerivedMediaAfterDurableChange(from: rollbackState.project)
            // Update the banner without firing the automatic recovery callback:
            // this transaction already rebuilt and saved exactly once.
            for replacement in staged { mediaAvailability.clearIdentityMismatch(replacement.id) }
            refreshMediaAvailability(notifyRestored: false)
            rewriteHistoryMedia(staged)
            setStatus(
                staged.count == 1
                    ? "Reconnected \(media.name)"
                    : "Reconnected \(staged.count) files"
            )
        } catch {
            if didMutate {
                await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
                refreshMediaAvailability(notifyRestored: false)
            } else {
                show(error)
            }
        }
    }

    private func stagedRelink(
        _ original: ProjectMedia,
        to url: URL,
        allowWeakMatch: Bool
    ) async throws -> ProjectMedia {
        var replacement = try await MediaProbe.inspect(url: url)
        guard isCompatibleRelink(original: original, replacement: replacement),
              (!allowWeakMatch || RelinkCompatibility.weakDurationPreservesHistory(
                  original: original,
                  replacement: replacement
              )),
              hasStrongIdentityMatch(original, replacement) ||
                (allowWeakMatch && original.sourceFingerprint == nil)
        else {
            throw NativeEditorError.incompatibleMedia(url.lastPathComponent)
        }
        replacement.id = original.id
        return replacement
    }

    private func hasStrongIdentityMatch(_ original: ProjectMedia, _ replacement: ProjectMedia) -> Bool {
        guard let expected = original.sourceFingerprint else { return false }
        return replacement.sourceFingerprint == expected
    }

    /// Relink is recovery, not source replacement. Re-encodes may change file
    /// size or resolution, so compatibility uses observable editorial identity:
    /// broad kind, aspect, audio availability, total duration, and every source
    /// window the existing edit addresses. Deliberate replacement remains a
    /// separate import workflow.
    private func isCompatibleRelink(original: ProjectMedia, replacement: ProjectMedia) -> Bool {
        guard original.isImage == replacement.isImage else { return false }
        let originalAspect = Double(original.width) / Double(max(1, original.height))
        let replacementAspect = Double(replacement.width) / Double(max(1, replacement.height))
        guard originalAspect > 0, replacementAspect > 0,
              abs(log(originalAspect / replacementAspect)) <= log(1.05)
        else { return false }
        if original.isImage { return true }
        guard replacement.duration.isFinite, replacement.duration > 0 else { return false }
        let durationTolerance = max(1, original.duration * 0.05)
        guard abs(replacement.duration - original.duration) <= durationTolerance else { return false }
        guard replacement.duration + 0.05 >= requiredSourceEnd(for: original.id) else { return false }
        return !original.hasAudio || replacement.hasAudio
    }

    private func requiredSourceEnd(for mediaID: UUID) -> Double {
        let clipEnd = project.clips
            .filter { $0.mediaID == mediaID }
            .map(\.sourceEnd)
            .max() ?? 0
        let wordEnd = (project.transcript ?? [])
            .filter { $0.mediaID == mediaID }
            .map(\.end)
            .max() ?? 0
        let overlayEnd = (project.overlays ?? [])
            .filter { $0.mediaID == mediaID }
            .map { $0.sourceStart + $0.duration }
            .max() ?? 0
        return max(clipEnd, max(wordEnd, overlayEnd))
    }

    func refreshMediaAvailability(notifyRestored: Bool = true) {
        mediaAvailability.refresh(notifyRestored: notifyRestored)
    }

    /// Rebuilds everything that could not be built while the files were away:
    /// the composition, and the thumbnails and waveforms whose earlier attempts
    /// found nothing to read.
    func reloadAfterRecovery(restartDerived: Bool = true) async throws {
        clearError()
        if !project.clips.isEmpty {
            try await rebuildComposition(preserveTime: true)
        } else {
            try await validateAvailableMediaIdentity()
        }
        try await persist()
        if restartDerived {
            for media in project.media { await restartDerivedMedia(for: media) }
        }
        setStatus("Ready")
    }

    func validateAvailableMediaIdentity() async throws {
        for media in project.media where FileManager.default.fileExists(atPath: media.url.path) {
            guard let expected = media.sourceFingerprint else { continue }
            let revision = try MediaResourceRevision(url: media.url, fingerprint: expected)
            if validatedMediaRevisions[media.id] == revision { continue }
            let actual = try await MediaSourceFingerprint.compute(url: media.url)
            guard actual == expected else {
                mediaAvailability.markOffline(media)
                throw NativeEditorError.incompatibleMedia(media.name)
            }
            validatedMediaRevisions[media.id] = revision
        }
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

struct MediaResourceRevision: Equatable {
    let path: String
    let size: UInt64
    let modified: Date?
    let created: Date?
    let resourceIdentifier: String?
    let fingerprint: String

    init(url: URL, fingerprint: String) throws {
        let values = try url.resourceValues(forKeys: [
            .fileSizeKey, .contentModificationDateKey, .creationDateKey, .fileResourceIdentifierKey,
        ])
        path = url.resolvingSymlinksInPath().path
        size = UInt64(values.fileSize ?? 0)
        modified = values.contentModificationDate
        created = values.creationDate
        resourceIdentifier = values.fileResourceIdentifier.map(String.init(describing:))
        self.fingerprint = fingerprint
    }
}

enum RelinkCompatibility {
    /// Legacy projects lack an exact source fingerprint. A confirmed candidate
    /// may be longer, but cannot be materially shorter: history snapshots can
    /// still address ranges no longer present in the current edit.
    static func weakDurationPreservesHistory(
        original: ProjectMedia,
        replacement: ProjectMedia
    ) -> Bool {
        original.isImage || replacement.duration + 0.05 >= original.duration
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
        if media.sourceFingerprint == nil {
            let warning = NSAlert()
            warning.messageText = "Confirm the original source"
            warning.informativeText = "Yapper will verify newer imports exactly. Older projects do not contain that identity, so confirm that this is the same file—not replacement footage."
            warning.addButton(withTitle: "Reconnect")
            warning.addButton(withTitle: "Cancel")
            guard warning.runModal() == .alertFirstButtonReturn else { return }
        }
        Task {
            await session.relinkMedia(
                media,
                to: url,
                allowUnverifiedPrimary: media.sourceFingerprint == nil
            )
        }
    }
}
