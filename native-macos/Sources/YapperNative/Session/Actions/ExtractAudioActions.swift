import Foundation

extension EditorProject {
    func canExtractAudio(from item: TimelineSelectionItem) -> Bool {
        let mediaID: UUID
        switch item {
        case .clip(let id):
            guard let clip = clips.first(where: { $0.id == id }),
                  !clip.locked, clip.audioDetached != true, clip.duration > 0 else { return false }
            mediaID = clip.mediaID
        case .overlay(let id):
            guard let overlay = overlays?.first(where: { $0.id == id }),
                  overlay.audioDetached != true, overlay.duration > 0 else { return false }
            mediaID = overlay.mediaID
        default: return false
        }
        return media.contains { $0.id == mediaID && !$0.isImage && $0.hasAudio }
    }

    /// Shares the original source bytes; the layer's trim and speed are independent.
    mutating func extractAudio(from item: TimelineSelectionItem) -> ProjectAudioLayer? {
        guard canExtractAudio(from: item) else { return nil }
        let mediaID: UUID
        let start: Double, length: Double, sourceStart: Double, rate: Double, volume: Double
        switch item {
        case .clip(let id):
            guard let index = clips.firstIndex(where: { $0.id == id }) else { return nil }
            let clip = clips[index]
            mediaID = clip.mediaID
            start = clips.prefix(index).reduce(0) { $0 + $1.duration }
            length = clip.duration
            sourceStart = clip.sourceStart
            rate = clip.resolvedPlaybackRate
            volume = resolvedVideoTrackVolume
            clips[index].audioDetached = true
        case .overlay(let id):
            guard let index = overlays?.firstIndex(where: { $0.id == id }),
                  let overlay = overlays?[index] else { return nil }
            mediaID = overlay.mediaID
            start = overlay.timelineStart
            length = overlay.duration
            sourceStart = overlay.sourceStart
            rate = overlay.resolvedPlaybackRate
            volume = 1
            overlays?[index].audioDetached = true
        default: return nil
        }
        guard let source = media.first(where: { $0.id == mediaID }) else { return nil }
        let layer = ProjectAudioLayer(
            url: source.url, name: "\(source.name) audio", timelineStart: start,
            duration: length, sourceStart: sourceStart, sourceDuration: source.duration,
            volume: volume, sourceKind: .external, sourceFingerprint: source.sourceFingerprint,
            packagedMediaID: source.packagedSource == true ? source.id : nil,
            playbackRate: rate == 1 ? nil : rate
        )
        audioLayers = (audioLayers ?? []) + [layer]
        updatedAt = Date()
        return layer
    }
}

@MainActor
extension EditorSession {
    @discardableResult
    func extractAudio(from item: TimelineSelectionItem) async -> Bool {
        let items = timelineSelection.contains(item) ? timelineSelection : [item]
        let clipIDs = items.compactMap { if case .clip(let id) = $0 { id } else { nil } }
        let overlayIDs = items.compactMap { if case .overlay(let id) = $0 { id } else { nil } }
        let result = await performAppAction(ExtractAudioInput(
            clipIDs: clipIDs.sorted { $0.uuidString < $1.uuidString },
            overlayIDs: overlayIDs.sorted { $0.uuidString < $1.uuidString }
        ))
        return result.status == .applied
    }
}

extension AppActionRegistry {
    func registerExtractAudio() {
        register(ExtractAudioInput.self, availability: { session in
            let project = session.project
            return project.clips.contains { project.canExtractAudio(from: .clip($0.id)) }
                || (project.overlays ?? []).contains { project.canExtractAudio(from: .overlay($0.id)) }
                ? .available : .init(reason: "Select an unlocked video clip with audio to extract.")
        }) { session, input in
            guard !input.clipIDs.isEmpty || !input.overlayIDs.isEmpty else {
                throw AppActionError("Select a video clip to extract audio.")
            }
            guard Set(input.clipIDs).isSubset(of: Set(session.project.clips.map(\.id))),
                  Set(input.overlayIDs).isSubset(of: Set((session.project.overlays ?? []).map(\.id))) else {
                throw AppActionError("A requested clip no longer exists.")
            }
            var changes: [AppActionChange] = []
            var skipped: [UUID] = []
            var selection: Set<TimelineSelectionItem> = []
            session.updateProject { project in
                for item in input.clipIDs.map(TimelineSelectionItem.clip) + input.overlayIDs.map(TimelineSelectionItem.overlay) {
                    let id: UUID
                    switch item { case .clip(let value), .overlay(let value): id = value; default: continue }
                    guard let layer = project.extractAudio(from: item) else { skipped.append(id); continue }
                    selection.insert(.audio(layer.id))
                    changes.append(.init(targetID: id, property: "audioDetached", before: "false", after: "true"))
                    changes.append(.init(targetID: layer.id, property: "audioLayer", before: "absent", after: layer.name))
                }
            }
            let count = selection.count
            let message = count == 0 ? "No audio extracted; selected clips were locked, silent or already extracted."
                : "Extracted audio from \(count) clip\(count == 1 ? "" : "s") · ⌘Z to undo"
                    + (skipped.isEmpty ? "" : " · \(skipped.count) skipped")
            let extractedSelection = selection
            return AppActionMutation(message: message, changes: changes, skippedIDs: skipped, afterCommit: {
                if !extractedSelection.isEmpty { session.setTimelineSelection(extractedSelection) }
            })
        }
    }
}
