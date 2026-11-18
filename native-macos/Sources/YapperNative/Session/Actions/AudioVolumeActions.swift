import Foundation

/// Faders and mute controls for the sounds on the timeline.
extension AppActionRegistry {
    func registerAudioVolume() {
        register(AudioVolumeInput.self, availability: { session in
            session.project.clips.isEmpty && (session.project.audioLayers ?? []).isEmpty
                ? .init(reason: "Add video or sound before setting volume.") : .available
        }) { session, input in
            let ids = Set(input.layerIDs)
            guard ids.isSubset(of: Set((session.project.audioLayers ?? []).map(\.id))) else {
                throw AppActionError("A requested audio layer no longer exists.")
            }
            guard input.videoTrack || !ids.isEmpty else { throw AppActionError("Choose audio layers or set videoTrack.") }
            let volume = AudioLevel.clamped(input.volume)
            var changes: [AppActionChange] = []
            session.updateProject { project in
                for index in project.audioLayers?.indices ?? 0..<0 where ids.contains(project.audioLayers![index].id) {
                    let layer = project.audioLayers![index]
                    guard layer.volume != volume else { continue }
                    project.audioLayers![index].volume = volume
                    changes.append(.init(targetID: layer.id, property: "volume", before: String(layer.volume), after: String(volume)))
                }
                if input.videoTrack, project.resolvedVideoTrackVolume != volume {
                    changes.append(.init(targetID: project.id, property: "videoTrackVolume",
                                         before: String(project.resolvedVideoTrackVolume), after: String(volume)))
                    project.videoTrackVolume = volume
                    // Pulling a fader off zero is asking to hear it, so the mute
                    // that was silencing it stands down.
                    if volume > 0, project.videoTrackMuted == true {
                        changes.append(.init(targetID: project.id, property: "videoTrackMuted", before: "true", after: "false"))
                        project.videoTrackMuted = nil
                    }
                }
                if !changes.isEmpty { project.updatedAt = Date() }
            }
            let label = input.videoTrack && ids.isEmpty ? "Video volume" : "Volume"
            return AppActionMutation(message: changes.isEmpty ? "Already at that volume." : "\(label) \(AudioLevel.percent(volume))%",
                                     changes: changes)
        }
        register(AudioMuteInput.self, availability: { session in
            (session.project.audioLayers ?? []).isEmpty
                ? .init(reason: "Add audio to the timeline first.") : .available
        }) { session, input in
            let layers = try session.actionAudioLayers(input.layerIDs)
            let updated = layers.filter { $0.isMuted != input.muted }.map { layer in
                var copy = layer
                copy.muted = input.muted ? true : nil
                return copy
            }
            guard !updated.isEmpty else {
                return .init(message: input.muted ? "Audio already muted." : "Audio already unmuted.")
            }
            return try session.mutateActionAudioLayers(
                updated, message: input.muted ? "Audio muted" : "Audio unmuted"
            )
        }
    }
}
