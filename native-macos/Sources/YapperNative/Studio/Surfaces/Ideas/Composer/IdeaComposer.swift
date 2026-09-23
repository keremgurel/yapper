import SwiftUI

/// One field to dump a thought into: type, paste a link, or dictate. On the
/// page it is a card that grows with what is written; expanded, the same
/// card fills the surface as a plain writing column.
struct IdeaComposer: View {
    let expanded: Bool
    let onToggleExpanded: () -> Void
    @ObservedObject var draft: CaptureDraft = .shared
    @ObservedObject var actions: ComposerActions = .shared
    @ObservedObject var dictation: DictationController = .shared
    @State private var contentHeight: CGFloat = 28

    private var fontSize: CGFloat { expanded ? 17 : 15 }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            field
            ComposerFooter(expanded: expanded, onToggleExpanded: onToggleExpanded)
        }
    }

    private var field: some View {
        ZStack(alignment: .topLeading) {
            ComposerTextView(
                draft: draft,
                fontSize: fontSize,
                editable: !actions.saving && !dictation.transcribing,
                onSubmit: { Task { await actions.submit() } },
                onEscape: escape,
                contentHeight: $contentHeight
            )
            if draft.text.isEmpty {
                Text("Capture a thought, paste a reference, or ask Chirpy for ideas…")
                    .font(.system(size: fontSize))
                    .foregroundStyle(.secondary)
                    .padding(.leading, ComposerTextView.inset.width + 5)
                    .padding(.top, ComposerTextView.inset.height)
                    .allowsHitTesting(false)
            }
        }
        .frame(height: expanded ? nil : min(max(contentHeight, 28), 320))
        .frame(maxHeight: expanded ? .infinity : nil)
    }

    /// Escape cancels a take first; otherwise it brings the card back.
    private func escape() {
        if dictation.recording {
            dictation.cancel()
        } else if expanded {
            onToggleExpanded()
        }
    }
}

/// The composer on the page: the hairline card.
struct IdeaComposerCard: View {
    let namespace: Namespace.ID
    let onExpand: () -> Void

    var body: some View {
        IdeaComposer(expanded: false, onToggleExpanded: onExpand)
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .background(NativeCardBackground().matchedGeometryEffect(id: "ideas.composer", in: namespace))
    }
}

/// The composer grown to the whole surface: a centred writing column.
struct IdeaComposerFullWindow: View {
    let namespace: Namespace.ID
    let onCollapse: () -> Void

    var body: some View {
        IdeaComposer(expanded: true, onToggleExpanded: onCollapse)
            .frame(maxWidth: 680)
            .padding(.horizontal, 40)
            .padding(.top, 40)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                Rectangle().fill(Color.editorBackground)
                    .matchedGeometryEffect(id: "ideas.composer", in: namespace)
            )
    }
}
