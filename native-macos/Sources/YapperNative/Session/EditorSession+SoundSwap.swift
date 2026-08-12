import Foundation

/// Swapping one sound for another without losing where it was.
///
/// Placing a sound is the easy half; the placing is what you spent the time on.
/// Deleting a mouse click and adding a classic click meant finding the moment
/// again, dropping the new one at the playhead and nudging it back into place,
/// which is a lot of work to change your mind about a click. This keeps the
/// moment, the level and the selection, and changes only what plays.
@MainActor
extension EditorSession {
    /// Replaces the sound on `layerID` with `effect`, in place.
    func replaceSound(_ layerID: UUID, with effect: SoundEffectDescriptor) async {
        guard
            let existing = project.audioLayers?.first(where: { $0.id == layerID }),
            existing.builtInID != effect.id
        else { return }

        do {
            let url = try await soundEffectService.fileURL(for: effect)
            await commitTimelineEdit(successStatus: "Swapped in \(effect.name) · ⌘Z to undo") {
                guard
                    let index = project.audioLayers?.firstIndex(where: { $0.id == layerID }),
                    let existing = project.audioLayers?[index],
                    existing.builtInID != effect.id
                else { return false }
                updateProject { project in
                    project.audioLayers?[index].url = url
                    project.audioLayers?[index].name = effect.name
                    project.audioLayers?[index].builtInID = effect.id
                    project.audioLayers?[index].sourceDuration = effect.duration
                // Back to the whole of the new sound, and no further than the
                // end of the video. A trim measured against the old file means
                // nothing to this one: a head cut off a three-second riser
                // would take most of a quarter-second pop with it.
                    project.audioLayers?[index].sourceStart = 0
                    project.audioLayers?[index].duration = min(
                        effect.duration,
                        max(0.02, duration - existing.timelineStart)
                    )
                    project.updatedAt = Date()
                }
                selectedAudioLayerID = layerID
                return true
            }
        } catch {
            show(error)
        }
    }

    /// The sounds a swap menu offers, grouped the way the library is so a long
    /// list stays browsable.
    var swappableEffects: [(category: SoundEffectCategory, effects: [SoundEffectDescriptor])] {
        SoundEffectCategory.allCases.compactMap { category in
            let effects = SoundEffectDescriptor.library.filter { $0.category == category }
            return effects.isEmpty ? nil : (category, effects)
        }
    }
}
