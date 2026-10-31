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
        Task { await performAppAction(AudioVolumeInput(layerIDs: [finished.id], videoTrack: false, volume: finished.volume)) }
    }

    func commitVideoTrackVolume() {
        guard
            let volume = audioLevels.endMainTrack(),
            project.resolvedVideoTrackVolume != volume
        else { return }
        Task { await performAppAction(AudioVolumeInput(layerIDs: [], videoTrack: true, volume: volume)) }
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
