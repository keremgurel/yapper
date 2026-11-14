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

    /// The draft is kept until the action has landed, not dropped the moment
    /// the drag ends. Dropping it first left a beat in which the waveform and
    /// the fader read the old saved level, so both jumped back and then
    /// forward again when the write arrived.
    func commitLayerVolume() {
        guard let finished = audioLevels.pending else { return }
        guard project.audioLayers?.first(where: { $0.id == finished.id })?.volume != finished.volume else {
            audioLevels.endLayer(ifStill: finished)
            return
        }
        Task {
            await performAppAction(AudioVolumeInput(layerIDs: [finished.id], videoTrack: false, volume: finished.volume))
            audioLevels.endLayer(ifStill: finished)
        }
    }

    func commitVideoTrackVolume() {
        guard let volume = audioLevels.mainTrack else { return }
        guard project.resolvedVideoTrackVolume != volume else {
            audioLevels.endMainTrack(ifStill: volume)
            return
        }
        Task {
            await performAppAction(AudioVolumeInput(layerIDs: [], videoTrack: true, volume: volume))
            audioLevels.endMainTrack(ifStill: volume)
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
