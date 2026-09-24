import SwiftUI

/// The openers still on the table, each a card. Clicking one lifts it into
/// the Hook slot while the old opener slides down here, each line keeping its
/// geometry on the way. The last row asks Chirpy for more.
struct IdeaCanvasHookAlternatives: View {
    var label = "Hook alternatives"
    /// Every hook after the chosen one, with its identity key.
    let hooks: [(key: String, text: String)]
    let namespace: Namespace.ID
    let onUse: (Int) -> Void
    let onRemove: (Int) -> Void
    let onMore: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle(label, meta: hooks.isEmpty ? nil : "\(hooks.count)")
            VStack(spacing: 8) {
                ForEach(Array(hooks.enumerated()), id: \.element.key) { offset, hook in
                    IdeaCanvasHookCard(
                        text: hook.text,
                        onUse: { onUse(offset) },
                        onRemove: { onRemove(offset) }
                    )
                    .matchedGeometryEffect(id: hook.key, in: namespace)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .offset(y: 6)),
                        removal: .opacity.combined(with: .scale(scale: 0.98))
                    ))
                }
                IdeaCanvasMoreHooksRow(hasHooks: !hooks.isEmpty, action: onMore)
            }
        }
    }
}

/// One alternative opener. The card is the button; the remove control shows
/// on hover.
private struct IdeaCanvasHookCard: View {
    let text: String
    let onUse: () -> Void
    let onRemove: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: onUse) {
            Text(text)
                .font(.system(size: 14))
                .lineSpacing(3)
                .foregroundStyle(hovering ? Color.primary : Color.primary.opacity(0.85))
                .frame(maxWidth: .infinity, alignment: .leading)
                .multilineTextAlignment(.leading)
                .padding(.leading, 16).padding(.trailing, 36).padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(hovering ? Color.studioFaintFill : Color.panelBackground)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(hovering ? Color.studioLineStrong : Color.studioLine, lineWidth: 1)
                )
        }
        .buttonStyle(.studioPlain)
        .help("Use this hook")
        .overlay(alignment: .topTrailing) {
            if hovering {
                Button(action: onRemove) {
                    Image(systemName: "xmark").font(.system(size: 11, weight: .semibold))
                        .frame(width: 22, height: 22)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .foregroundStyle(.secondary)
                .help("Remove")
                .padding(6)
            }
        }
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.15), value: hovering)
    }
}

private struct IdeaCanvasMoreHooksRow: View {
    let hasHooks: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            IdeaCanvasChirpyLabel(hasHooks ? "Ask Chirpy for more options" : "Ask Chirpy for options")
                .font(.system(size: 14))
                .foregroundStyle(hovering ? .primary : .secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(hovering ? Color.studioFaintFill : .clear)
                )
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
    }
}
