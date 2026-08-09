import SwiftUI

/// The list of sounds one already on the timeline can be swapped for.
///
/// Shelved by what each effect is for, the same way the library is, because
/// nobody hunts eighteen sounds by name. The one it already is sits at the top
/// with a tick, so the menu says what you have as well as what you could have.
///
/// Used by both the right-click on the timeline and the inspector's Replace
/// button: one list, so the two cannot drift apart.
struct SoundSwapMenu: View {
    let session: EditorSession
    let layer: ProjectAudioLayer

    var body: some View {
        ForEach(session.swappableEffects, id: \.category) { shelf in
            Section(shelf.category.title) {
                ForEach(shelf.effects) { effect in
                    Button {
                        Task { await session.replaceSound(layer.id, with: effect) }
                    } label: {
                        if effect.id == layer.builtInID {
                            Label(effect.name, systemImage: "checkmark")
                        } else {
                            Text(effect.name)
                        }
                    }
                    .disabled(effect.id == layer.builtInID)
                }
            }
        }
    }
}
