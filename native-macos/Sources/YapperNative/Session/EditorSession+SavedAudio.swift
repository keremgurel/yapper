import Foundation

extension EditorSession {
    /// Puts a sound from the library on the timeline at the playhead.
    ///
    /// Separate from `importAudio` because the library already knows what the
    /// file is called and how long it is: it was probed once, on the way in.
    /// Nothing is copied. The layer points at the library's own copy, so the
    /// same bed used in ten projects is one file on disk.
    func addSavedAudio(
        _ item: SavedAudio,
        from store: AudioLibraryStore,
        afterFingerprint: (() async -> Void)? = nil
    ) async {
        guard duration > 0 else { return }
        let url = store.url(for: item)
        guard let fingerprint = try? await MediaSourceFingerprint.compute(url: url) else {
            show(NativeEditorError.noAudioTrack(item.name))
            return
        }
        await afterFingerprint?()
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        guard store.ownsAvailable(item) else {
            show(NativeEditorError.noAudioTrack(item.name))
            return
        }
        let start = min(currentTime, max(0, duration - 0.02))
        let layerDuration = min(item.duration, max(0.02, duration - start))
        let layer = ProjectAudioLayer(
            url: url,
            name: item.name,
            timelineStart: start,
            duration: layerDuration,
            sourceDuration: item.duration,
            sourceKind: .saved,
            sourceFingerprint: fingerprint,
            savedAudioID: item.id,
            savedAudioHash: item.contentHash
        )
        updateProject { project in
            project.audioLayers = (project.audioLayers ?? []) + [layer]
            project.updatedAt = Date()
        }
        selectTimelineItem(.audio(layer.id))
        _ = await commitPreparedTimelineEdit(rollbackState: rollbackState)
    }

    func removeSavedAudio(_ item: SavedAudio, from store: AudioLibraryStore) async -> Bool {
        guard await beginPreparedTimelineEdit() != nil else { return false }
        defer { endPreparedTimelineEdit() }
        return await store.remove(item.id) {
            self.referencesSavedAudio(item, at: store.url(for: item))
        }
    }
}
