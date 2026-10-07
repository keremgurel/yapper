import SwiftUI

/// The library and editor use the same search control and matching rules.
struct AudioSearchField: View {
    @Binding var search: String
    var prompt = "Search sounds"
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            TextField(prompt, text: $search)
                .textFieldStyle(.plain)
                .font(.studioBody)
                .focused($isFocused)
                .accessibilityLabel(prompt)
            if !search.isEmpty {
                Button {
                    search = ""
                    isFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
                .accessibilityLabel("Clear search")
                .help("Clear search")
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 28)
        .background {
            Capsule().fill(Color.studioInputBackground)
                .overlay {
                    Capsule().strokeBorder(
                        isFocused ? Color.yapperOrange : Color.studioLine,
                        lineWidth: 1
                    )
                }
        }
    }
}
