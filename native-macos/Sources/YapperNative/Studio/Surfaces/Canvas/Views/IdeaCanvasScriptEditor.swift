import SwiftUI

/// The full script, always there to type into. The title carries the word
/// count and how long it takes to say at 150 words a minute.
struct IdeaCanvasScriptEditor: View {
    let text: String
    let onChange: (String) -> Void
    let onWrite: () -> Void
    let onAsk: () -> Void

    var body: some View {
        let words = IdeaCanvasText.wordCount(text)
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(
                "Script",
                meta: words > 0 ? "\(words) words · \(IdeaCanvasText.speakingTime(words: words))" : nil
            ) {
                IdeaCanvasAskChip(action: onAsk)
                if words == 0 {
                    Button("Write it for me", action: onWrite)
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                }
            }
            IdeaCanvasGrowingEditor(
                text: Binding(get: { text }, set: { onChange($0) }),
                placeholder: "The words you will say. Type here, or have Chirpy write a first draft.",
                font: .system(size: 16),
                lineSpacing: 9,
                minHeight: 420
            )
        }
    }
}
