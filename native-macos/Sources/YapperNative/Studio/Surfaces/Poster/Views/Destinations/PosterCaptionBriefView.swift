import SwiftUI

/// The caption prompt, folded away. Open it when this post needs a
/// different angle; a customized prompt says so in its summary line.
struct PosterCaptionBriefView: View {
    let value: String
    let disabled: Bool
    let onChange: (String) -> Void

    private var customized: Bool { value != PosterCaptionBrief.standard }

    var body: some View {
        PosterDisclosure(title: "Caption prompt", meta: customized ? "Customized for this post" : nil) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text("Controls captions, hashtags, and the YouTube title. Add context or requests.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                    Spacer()
                    if customized {
                        Button("Reset", systemImage: "arrow.counterclockwise") { onChange(PosterCaptionBrief.standard) }
                            .buttonStyle(EditorGhostButtonStyle(size: .small))
                            .disabled(disabled)
                    }
                }
                NativeTextArea(
                    text: Binding(get: { value }, set: { onChange(String($0.prefix(2000))) }),
                    placeholder: "Add context: audience, offer, call to action, keywords, tone, hashtags, or anything to avoid",
                    font: .system(size: 13),
                    minHeight: 120
                )
                .disabled(disabled)
                Text("\(value.count)/2000").font(.system(size: 11).monospacedDigit()).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }
}
