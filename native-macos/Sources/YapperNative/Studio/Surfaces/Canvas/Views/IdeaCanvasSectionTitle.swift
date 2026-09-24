import SwiftUI

/// How every part of the canvas is named: a sentence-case title, a quiet
/// note beside it, and the part's controls on the same line.
struct IdeaCanvasSectionTitle<Title: View, Actions: View>: View {
    @ViewBuilder var title: () -> Title
    var meta: String?
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                title().font(.nativeSectionTitle)
                if let meta {
                    Text(meta).font(.system(size: 13)).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 2) { actions() }
        }
        .frame(minHeight: 28)
        .padding(.bottom, 8)
    }
}

extension IdeaCanvasSectionTitle where Title == Text {
    init(_ title: String, meta: String? = nil, @ViewBuilder actions: @escaping () -> Actions) {
        self.init(title: { Text(title) }, meta: meta, actions: actions)
    }
}

extension IdeaCanvasSectionTitle where Title == Text, Actions == EmptyView {
    init(_ title: String, meta: String? = nil) {
        self.init(title: { Text(title) }, meta: meta, actions: { EmptyView() })
    }
}

/// A small ghost button with the Chirpy sparkle, for "Ask" on a part.
struct IdeaCanvasAskChip: View {
    var label = "Ask"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            IdeaCanvasChirpyLabel(label).font(.system(size: 12, weight: .medium))
        }
        .buttonStyle(EditorGhostButtonStyle(size: .mini))
        .foregroundStyle(.secondary)
        .help("Ask Chirpy about this part")
    }
}
