import Foundation

/// The faders: what each track plays at, and what the timeline draws while you
/// are moving one.
@MainActor
extension EditorSession {
    /// What a sound is playing at, taking a fader being dragged over what is
    /// saved. The timeline's waveforms read this, which is what makes them
    /// follow the slider.
    func volume(for layer: ProjectAudioLayer) -> Double {
        audioLevels.volume(for: layer.id) ?? AudioLevel.clamped(layer.volume)
    }

    /// The same for the speaker's own track.
    var videoTrackVolume: Double {
        audioLevels.mainTrack ?? project.resolvedVideoTrackVolume
    }

    // MARK: - Dragging

    /// Called on every step of a drag. Nothing is written to the project: see
    /// `AudioLevelDraft`.
    func previewVolume(_ volume: Double, for layerID: UUID) {
        audioLevels.set(volume, for: layerID)
    }

    func previewVideoTrackVolume(_ volume: Double) {
        audioLevels.setMainTrack(volume)
    }

    // MARK: - Letting go

    func commitLayerVolume() {
        guard
            let finished = audioLevels.endLayer(),
            project.audioLayers?.first(where: { $0.id == finished.id })?.volume != finished.volume
        else { return }
        scheduleCompositionCommit(
            settleFor: .milliseconds(50),
            successStatus: "Volume \(AudioLevel.percent(finished.volume))%"
        ) { [self] in
            guard let index = project.audioLayers?.firstIndex(where: { $0.id == finished.id }) else { return false }
            updateProject { project in
                project.audioLayers?[index].volume = finished.volume
                project.updatedAt = Date()
            }
            return true
        }
    }

    func commitVideoTrackVolume() {
        guard
            let volume = audioLevels.endMainTrack(),
            project.resolvedVideoTrackVolume != volume
        else { return }
        scheduleCompositionCommit(
            settleFor: .milliseconds(50),
            successStatus: "Video volume \(AudioLevel.percent(volume))%"
        ) { [self] in
            updateProject { project in
                project.videoTrackVolume = volume
                // Pulling a fader off zero is asking to hear it, so the mute that
                // was silencing it stands down. Leaving both on means a fader that
                // visibly moves and changes nothing.
                if volume > 0, project.videoTrackMuted == true { project.videoTrackMuted = nil }
                project.updatedAt = Date()
            }
            return true
        }
    }

    /// Runs "make all the pops 80%": the layers it names, in one edit.
    ///
    /// Returns what it changed, one line per sound, so the assistant can report
    /// it the way the placement pass reports a cutaway. Empty when the sentence
    /// named sounds this timeline does not have.
    @discardableResult
    func applyLevelCommand(
        _ command: SoundLevelCommand,
        owner: LongOperationLease? = nil
    ) async -> [String] {
        var notes: [String] = []
        let success = await commitTimelineEdit(successStatus: command.summary, owner: owner) { [self] in
            if command.target == .videoTrack {
                guard project.resolvedVideoTrackVolume != command.volume else { return false }
                updateProject { project in
                    project.videoTrackVolume = command.volume == 1 ? nil : command.volume
                    project.updatedAt = Date()
                }
                notes = [command.summary]
                return true
            }

            let wanted = (project.audioLayers ?? []).filter { matches($0, command.target) }
            guard wanted.contains(where: { $0.volume != command.volume }) else { return false }
            let ids = Set(wanted.map(\.id))
            updateProject { project in
                for index in project.audioLayers?.indices ?? (0 ..< 0).indices {
                    guard let id = project.audioLayers?[index].id, ids.contains(id) else { continue }
                    project.audioLayers?[index].volume = command.volume
                }
                project.updatedAt = Date()
            }
            notes = [command.summary + " (\(wanted.count) sound\(wanted.count == 1 ? "" : "s"))"]
            return true
        }
        return success ? notes : []
    }

    /// What a sentence naming an effect could not find, for the reply that has
    /// to say so rather than claim a silent success.
    func levelCommandEmptyReason(_ command: SoundLevelCommand) -> String {
        switch command.target {
        case .videoTrack, .allSounds:
            "There are no sounds on the timeline to set the level of."
        case let .effect(id):
            {
                let name = SoundEffectDescriptor.library.first { $0.id == id }?.name ?? id
                return "There is no \(name) on the timeline."
            }()
        }
    }

    private func matches(_ layer: ProjectAudioLayer, _ target: SoundLevelCommand.Target) -> Bool {
        switch target {
        case .allSounds: true
        case .videoTrack: false
        case let .effect(id): layer.builtInID == id
        }
    }

    /// Sets a level in one go, for a button rather than a drag.
    func setVideoTrackVolume(_ volume: Double) {
        previewVideoTrackVolume(volume)
        commitVideoTrackVolume()
    }

    func setLayerVolume(_ volume: Double, for layerID: UUID) {
        previewVolume(volume, for: layerID)
        commitLayerVolume()
    }
}
