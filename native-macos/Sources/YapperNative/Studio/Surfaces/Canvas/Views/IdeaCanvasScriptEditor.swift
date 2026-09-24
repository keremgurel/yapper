import SwiftUI

/// The full script, always there to type into. The title carries the word
/// count and how long it takes to say at 150 words a minute.
struct IdeaCanvasScriptEditor: View {
    var label = "Script"
    /// Overrides the word count and speaking time, e.g. a long-form's runtime.
    var meta: String?
    var placeholder = "The words you will say. Type here, or have Chirpy write a first draft."
    /// Shows `## ` headings and bracketed notes as what they are (long-form
    /// and articles). A short's script is plain spoken words.
    var structured = false
    let text: String
    let onChange: (String) -> Void
    let onWrite: () -> Void
    let onAsk: () -> Void

    var body: some View {
        let words = IdeaCanvasText.wordCount(text)
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(
                label,
                meta: meta ?? (words > 0 ? "\(words) words · \(IdeaCanvasText.speakingTime(words: words))" : nil)
            ) {
                IdeaCanvasAskChip(action: onAsk)
                if words == 0 {
                    Button("Write it for me", action: onWrite)
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                }
            }
            if structured {
                IdeaCanvasStyledScriptView(
                    text: Binding(get: { text }, set: { onChange($0) }),
                    placeholder: placeholder
                )
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(placeholder)
                            .font(.system(size: 16))
                            .foregroundStyle(.tertiary)
                            .padding(.top, 4)
                            .allowsHitTesting(false)
                    }
                }
            } else {
                IdeaCanvasGrowingEditor(
                    text: Binding(get: { text }, set: { onChange($0) }),
                    placeholder: placeholder,
                    font: .system(size: 16),
                    lineSpacing: 9,
                    minHeight: 420
                )
            }
        }
    }
}
