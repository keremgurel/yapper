import Foundation

extension AppActionRegistry {
    func registerAdditionalPropertyActions() {
        register(VideoFramingKeyInput.self, availability: { _ in .available }) { session, input in
            guard let clip = session.project.clips.first(where: { $0.id == input.clipID }) else { throw AppActionError("That clip no longer exists.") }
            if clip.locked { return .init(message: "Locked clip skipped.", skippedIDs: [clip.id]) }
            guard input.sourceTime >= clip.sourceStart, input.sourceTime <= clip.sourceEnd else { throw AppActionError("Choose a keyframe time inside the clip’s source range.") }
            let updated: TimelineClip
            switch input.operation {
            case .set:
                let framing = VideoFramingTrack.framing(of: clip, atSource: input.sourceTime)
                    .with(scale: input.scale, x: input.x, y: input.y, rotation: input.rotation)
                updated = VideoFramingTrack.setting(framing, atSource: input.sourceTime, in: clip)
            case .remove: updated = VideoFramingTrack.removingKey(atSource: input.sourceTime, in: clip)
            case .clear: updated = VideoFramingTrack.clearingKeys(atSource: input.sourceTime, in: clip)
            case .move:
                guard let destination = input.destination, destination >= clip.sourceStart, destination <= clip.sourceEnd else {
                    throw AppActionError("Choose a keyframe destination inside the clip.")
                }
                updated = VideoFramingTrack.movingKey(in: clip, from: input.sourceTime, to: destination)
            }
            let changes = try PropertyChanges.diff(targetID: clip.id, before: clip, after: updated)
            session.updateProject { project in
                guard let index = project.clips.firstIndex(where: { $0.id == clip.id }) else { return }
                project.clips[index] = updated
            }
            let done = switch input.operation {
            case .set: "Keyframe set"
            case .remove: "Keyframe removed"
            case .clear: "Keyframes cleared"
            case .move: "Keyframe moved"
            }
            return .init(message: changes.isEmpty ? "Keyframes already have those settings." : "\(done) · ⌘Z to undo", changes: changes)
        }
        register(AudioReplaceInput.self, availability: { _ in .available }) { session, input in
            guard let effect = SoundEffectDescriptor.library.first(where: { $0.id == input.effectID }) else { throw AppActionError("Choose a sound from the library.") }
            let layers = try session.actionAudioLayers(input.layerIDs)
            let url = try await session.soundEffectService.fileURL(for: effect)
            let updated = layers.map { layer -> ProjectAudioLayer in
                guard layer.builtInID != effect.id else { return layer }
                return layer.replacingSound(with: effect, url: url, timelineDuration: session.duration)
            }
            return try session.mutateActionAudioLayers(updated, message: "Sound replaced · ⌘Z to undo")
        }
        register(AudioTrimInput.self, availability: { _ in .available }) { session, input in
            guard input.sourceStart != nil || input.duration != nil || input.timelineStart != nil else {
                throw AppActionError("Include a source start, duration or timeline start.")
            }
            let updated = try session.actionAudioLayers(input.layerIDs).map { layer in
                var copy = layer
                if let start = input.sourceStart { copy.sourceStart = start }
                if let duration = input.duration { copy.duration = duration }
                if let start = input.timelineStart { copy.timelineStart = start }
                guard copy.timelineStart + copy.duration <= session.duration + 0.000001,
                      copy.sourceStart + copy.duration * copy.resolvedPlaybackRate <= (layer.sourceDuration ?? layer.sourceEnd) + 0.000001 else {
                    throw AppActionError("Keep the sound inside its source and the video timeline.")
                }
                return copy
            }
            let moved = input.sourceStart == nil && input.duration == nil
            return try session.mutateActionAudioLayers(updated, message: moved ? "Sound moved · ⌘Z to undo" : "Audio trim saved · ⌘Z to undo")
        }
    }
}

extension AudioTrimInput {
    init(layerIDs: [UUID], sourceStart: Double?, duration: Double?) {
        self.init(layerIDs: layerIDs, sourceStart: sourceStart, duration: duration, timelineStart: nil)
    }
}

extension EditorSession {
    func actionAudioLayers(_ ids: [UUID]) throws -> [ProjectAudioLayer] {
        try ids.map { id in
            guard let layer = project.audioLayers?.first(where: { $0.id == id }) else { throw AppActionError("That audio layer no longer exists.") }
            return layer
        }
    }
    func mutateActionAudioLayers(_ layers: [ProjectAudioLayer], message: String) throws -> AppActionMutation {
        var changes: [AppActionChange] = []
        for layer in layers {
            changes += try PropertyChanges.diff(targetID: layer.id, before: actionAudioLayers([layer.id])[0], after: layer)
        }
        let replacements = Dictionary(uniqueKeysWithValues: layers.map { ($0.id, $0) })
        updateProject { $0.audioLayers = ($0.audioLayers ?? []).map { replacements[$0.id] ?? $0 } }
        return .init(message: changes.isEmpty ? "Audio already has those settings." : message, changes: changes)
    }
}

extension ProjectAudioLayer {
    func replacingSound(with effect: SoundEffectDescriptor, url: URL, timelineDuration: Double) -> ProjectAudioLayer {
        var copy = self
        copy.url = url; copy.name = effect.name; copy.builtInID = effect.id; copy.sourceKind = .builtIn
        copy.sourceFingerprint = nil; copy.savedAudioID = nil; copy.savedAudioHash = nil; copy.packagedMediaID = nil
        copy.sourceDuration = effect.duration; copy.sourceStart = 0; copy.playbackRate = nil
        copy.duration = min(effect.duration, max(0.02, timelineDuration - timelineStart))
        return copy
    }
}

extension VideoFramingTrack {
    static func movingKey(in clip: TimelineClip, from source: Double, to destination: Double) -> TimelineClip {
        var keys = keys(of: clip)
        guard let index = keys.firstIndex(where: { abs($0.at - source) < minimumGap }) else { return clip }
        let lower = index > 0 ? keys[index - 1].at + minimumGap : clip.sourceStart
        let upper = index < keys.count - 1 ? keys[index + 1].at - minimumGap : clip.sourceEnd
        guard upper > lower else { return clip }
        keys[index].at = min(upper, max(lower, destination))
        var updated = clip; updated.framingKeys = keys.sorted { $0.at < $1.at }; return updated
    }
}
