import SwiftUI

/// Chirpy as part of the edit: the whole conversation, its template cards and
/// the box, at full height beside the transcript.
struct ChirpyColumn: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var conversation: AssistantConversation
    /// Bumped by ⌘K, which rebuilds the box so it takes the caret.
    @State private var focusToken = 0

    private var isWorking: Bool {
        conversation.isThinking || session.overlayPlacement == .working
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                ChirpyMascot(expression: isWorking ? .yap : .idle, talking: isWorking, size: 22)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Chirpy").font(.studioBodyStrong)
                    Text(isWorking ? AssistantWorkingLine.text(status: session.statusMessage) : "Ask for any edit")
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioTextMuted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if !conversation.isEmpty {
                    Button("Clear") { conversation.clear() }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                        .help("Start a new conversation. Your edits stay.")
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 52)
            Divider().opacity(0.6)
            AssistantChat(
                session: session,
                conversation: conversation,
                isWorking: isWorking,
                onEscape: {},
                composerHeight: 72,
                emptyState: .simple
            )
            .id(focusToken)
        }
        .background(Color.panelBackground)
        // ⌘K asks the floating bird to open; here it means "take me to the box".
        .onChange(of: session.isAssistantOpen) { _, open in takeFocus(open) }
        .onAppear { takeFocus(session.isAssistantOpen) }
    }

    private func takeFocus(_ requested: Bool) {
        guard requested else { return }
        session.isAssistantOpen = false
        focusToken += 1
    }
}
