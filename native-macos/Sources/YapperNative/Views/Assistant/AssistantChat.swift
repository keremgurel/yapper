import SwiftUI

/// The conversation with Chirpy and the box under it: what both the floating
/// panel and the bar docked under the preview are made of. The chrome around
/// it (a drag handle, a resize edge, a collapse) belongs to whoever holds it.
struct AssistantChat: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var studioCommands = StudioWebCommands.shared
    @ObservedObject var conversation: AssistantConversation
    let isWorking: Bool
    /// Escape, once the `@` list has had its chance at it.
    let onEscape: () -> Void
    /// Under the preview the box is shorter, since the bar has less height.
    var composerHeight: CGFloat = 96
    /// What the empty conversation suggests. Simple mode asks for what
    /// creators talking to camera do, not for overlays.
    var emptyState: AssistantEmptyContent? = nil

    /// Held out here rather than inside the box so an example can be pressed
    /// into it from the empty state.
    @State private var draft = ""
    @State private var caret = 0
    @State private var focusRequest = 0
    /// Set by Escape, so the list can be put away without giving up the `@`
    /// that is already typed.
    @State private var mentionDismissed = false
    @State private var mentionActive = 0

    private var mention: MentionQuery {
        MentionQuery(
            text: draft,
            caret: caret,
            in: session.placeableMedia,
            isDismissed: mentionDismissed
        )
    }

    @ViewBuilder
    private var transcript: some View {
        if conversation.isEmpty {
            AssistantEmptyState(
                content: emptyState ?? (session.assistantUsesStudioBrain ? .studio : .editor),
                onPick: useExample
            )
        } else {
            AssistantTranscript(conversation: conversation, session: session)
        }
    }

    private func useExample(_ prompt: String) {
        draft = prompt
        caret = prompt.utf16.count
        focusRequest += 1
    }

    private func applyStudioPrompt() {
        guard let prompt = studioCommands.takeAssistantPrompt() else { return }
        draft = prompt
        caret = prompt.utf16.count
        focusRequest += 1
    }

    /// The conversation, and the `@` list when there is one.
    ///
    /// The list is drawn here, inside the panel, sitting on top of the
    /// conversation and directly above the box. Not as an overlay hanging off
    /// the box: an overlay is outside the layout, so nothing bounded it, and in
    /// a panel near the bottom of the screen it covered the box you were typing
    /// into and ran off the screen at the same time. Here it can do neither.
    private var content: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                transcript
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                if mention.isActive {
                    MentionSuggestionList(
                        files: mention.files,
                        active: min(mentionActive, mention.files.count - 1),
                        availableHeight: proxy.size.height - 12,
                        onPick: accept,
                        onHover: { mentionActive = $0 }
                    )
                    .padding(.horizontal, 10)
                    .padding(.bottom, 6)
                    .transition(.opacity.combined(with: .offset(y: 8)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Whatever happens, nothing in here leaves the panel.
        .clipped()
        .animation(.easeOut(duration: 0.12), value: mention.isActive)
        .onChange(of: draft) { _, _ in
            mentionDismissed = false
            mentionActive = 0
        }
    }

    private var composer: some View {
        AssistantComposer(
            session: session,
            instruction: $draft,
            caret: $caret,
            placeholder: emptyState?.placeholder ?? (session.assistantUsesStudioBrain
                ? AssistantComposer.studioPlaceholder
                : AssistantComposer.placeholder),
            isWorking: isWorking,
            focusRequest: $focusRequest,
            onListKey: handleListKey,
            onEscape: onEscape,
            onSend: send
        )
        .frame(height: composerHeight)
        .padding(10)
    }

    /// Returns true when the key belonged to the list rather than to the text.
    private func handleListKey(_ key: MentionTextView.ListKey) -> Bool {
        let files = mention.files
        guard !files.isEmpty else { return false }
        switch key {
        case .up:
            mentionActive = (mentionActive - 1 + files.count) % files.count
        case .down:
            mentionActive = (mentionActive + 1) % files.count
        case .accept:
            accept(files[min(mentionActive, files.count - 1)])
        case .dismiss:
            mentionDismissed = true
        }
        return true
    }

    private func accept(_ file: ProjectMedia) {
        guard let result = mention.accepting(file, in: draft) else { return }
        draft = result.text
        caret = result.caret
        mentionActive = 0
        focusRequest += 1
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isWorking, !text.isEmpty else { return }
        // Emptied the moment it is sent, the way a message box is: what you
        // asked for is in the transcript above now, not still under a cursor.
        draft = ""
        caret = 0
        // The assistant reaches every command the editor has, so a sentence
        // about silences trims silences rather than being read as an overlay
        // it cannot find.
        Task { await session.runAssistant(instruction: text) }
    }


    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
            if !session.assistantUsesStudioBrain, !conversation.isEmpty,
               draft.isEmpty, !isWorking, !session.placeableMedia.isEmpty {
                ImportedOverlaySuggestion(onPick: useExample, showsHint: false)
                    .padding(.horizontal, 12)
            }
            composer
        }
        // Opening it is asking to say something. It is built the moment it
        // appears, whether that was ⌘K, the bird being clicked or the bar
        // opening under the preview.
        .onAppear { applyStudioPrompt(); focusRequest += 1 }
        .onChange(of: studioCommands.assistantGeneration) { _, _ in
            applyStudioPrompt()
        }
    }
}
