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
        await performAppAction(AudioReplaceInput(layerIDs: [layerID], effectID: effect.id))
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
