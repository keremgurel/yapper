import SwiftUI

/// Chirpy under the preview, in Simple mode. The box is always there, so
/// asking is the first thing in reach rather than the smallest thing on
/// screen. The conversation above it opens when there is something to read
/// and folds away to give the preview its height back.
struct ChirpyDock: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var conversation: AssistantConversation
    @AppStorage("chirpyDockExpanded") private var expanded = false
    /// Bumped by ⌘K, which rebuilds the box so it takes the caret.
    @State private var focusToken = 0

    private var isWorking: Bool {
        conversation.isThinking || session.overlayPlacement == .working
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            AssistantChat(
                session: session,
                conversation: conversation,
                isWorking: isWorking,
                onEscape: { withAnimation(.easeOut(duration: 0.16)) { expanded = false } },
                composerHeight: 64,
                emptyState: .simple
            )
            .id(focusToken)
            .frame(height: expanded ? 240 : 84, alignment: .bottom)
            .clipped()
        }
        .background(Color.panelBackground)
        .overlay(alignment: .top) { Rectangle().fill(Color.studioLine).frame(height: 1) }
        // ⌘K asks the floating bird to open; here it means "take me to the box".
        .onChange(of: session.isAssistantOpen) { _, open in
            guard open else { return }
            session.isAssistantOpen = false
            withAnimation(.easeOut(duration: 0.16)) { expanded = true }
            focusToken += 1
        }
        .onChange(of: conversation.messages.count) { _, _ in
            // A reply opens the conversation, so the cards it may carry are seen.
            withAnimation(.easeOut(duration: 0.16)) { expanded = true }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            ChirpyMascot(expression: isWorking ? .yap : .idle, talking: isWorking, size: 20)
            Text(isWorking ? AssistantWorkingLine.text(status: session.statusMessage) : "Ask Chirpy")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 8)
            Button {
                withAnimation(.easeOut(duration: 0.16)) { expanded.toggle() }
            } label: {
                Image(systemName: expanded ? "chevron.down" : "chevron.up")
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .help(expanded ? "Fold the conversation away" : "Show the conversation")
        }
        .padding(.horizontal, 12)
        .frame(height: 34)
    }
}
