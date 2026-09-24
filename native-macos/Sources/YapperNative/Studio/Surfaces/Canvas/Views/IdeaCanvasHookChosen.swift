import SwiftUI

/// The opening line in use, set large because it is the first thing said.
/// Editable in place; choosing another happens in the alternatives.
struct IdeaCanvasHookChosen: View {
    var label = "Hook"
    var askLabel = "Give me five hooks"
    let hook: String?
    let hookKey: String?
    let namespace: Namespace.ID
    let onChange: (String) -> Void
    let onAskForHooks: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(label)
            if let hook, let hookKey {
                IdeaCanvasGrowingEditor(
                    text: Binding(get: { hook }, set: { onChange($0) }),
                    font: .system(size: 24, weight: .semibold),
                    lineSpacing: 5,
                    minHeight: 36
                )
                .matchedGeometryEffect(id: hookKey, in: namespace)
            } else {
                Button(action: onAskForHooks) {
                    IdeaCanvasChirpyLabel(askLabel)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .foregroundStyle(.secondary)
            }
        }
    }
}
