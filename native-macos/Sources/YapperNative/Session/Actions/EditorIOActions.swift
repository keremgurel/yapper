import Foundation

extension AppActionRegistry {
    func registerEditorIOActions() {
        registerWorkflow(ImportPickerInput.self) { session, input in
            await ImportPanels.importFiles(for: session, kind: input.kind)
        }
        registerWorkflow(ExportInput.self) { session, input in
            guard !session.project.clips.isEmpty else { throw AppActionError("Add video before exporting.") }
            switch input.destination {
            case .file: return await ImportPanels.exportFile(for: session)
            case .poster:
                let url = FileManager.default.temporaryDirectory
                    .appending(path: "yapper-poster-\(UUID().uuidString)").appendingPathExtension("mp4")
                return await session.exportForPosting(to: url)
            }
        }
        register(SavedAudioAddInput.self, availability: { _ in .available }) { session, input in
            let store = AudioLibraryStore.shared
            guard session.duration > 0, let item = store.items.first(where: { $0.id == input.savedAudioID }), store.ownsAvailable(item) else {
                throw AppActionError("Choose an available sound from your audio library and add video first.")
            }
            let url = store.url(for: item)
            let fingerprint = try await MediaSourceFingerprint.compute(url: url)
            try Task.checkCancellation()
            guard store.ownsAvailable(item) else { throw AppActionError("That library sound is no longer available.") }
            let time = try TimelineCue.resolve(input.at, project: session.project, playhead: session.currentTime)
            guard time >= 0, time <= session.duration else { throw AppActionError("Choose a time inside the video.") }
            let start = min(time, max(0, session.duration - 0.02))
            let layer = ProjectAudioLayer(url: url, name: item.name, timelineStart: start,
                duration: min(item.duration, max(0.02, session.duration - start)), sourceDuration: item.duration,
                volume: session.audioLibraryVolumes.volume(for: item.id.uuidString), sourceKind: .saved,
                sourceFingerprint: fingerprint, savedAudioID: item.id, savedAudioHash: item.contentHash)
            session.updateProject { $0.audioLayers = ($0.audioLayers ?? []) + [layer] }
            return .init(message: "Added \(item.name) · ⌘Z to undo",
                changes: [.init(targetID: layer.id, property: "audio", before: "none", after: item.name)],
                afterCommit: { session.selectTimelineItem(.audio(layer.id)) })
        }
    }
}
