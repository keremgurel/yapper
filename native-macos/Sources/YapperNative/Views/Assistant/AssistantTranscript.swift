import SwiftUI

/// The conversation, newest at the bottom.
///
/// Anchored to the bottom the way every chat is: a new message arrives where
/// your eye already is and pushes the older ones up out of the way, rather than
/// appearing at the end of a list you then have to go and find.
struct AssistantTranscript: View {
    @ObservedObject var conversation: AssistantConversation

    /// What the last row is called, so the scroller has something to aim at.
    private static let bottom = "assistant.transcript.bottom"

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(conversation.messages) { message in
                        AssistantMessageRow(message: message)
                            // Rises into place from below, which is the
                            // direction the transcript itself is moving.
                            .transition(
                                .asymmetric(
                                    insertion: .offset(y: 14).combined(with: .opacity),
                                    removal: .opacity
                                )
                            )
                    }
                    if conversation.isThinking {
                        ChirpyTypingIndicator()
                            .transition(.offset(y: 10).combined(with: .opacity))
                    }
                    // Zero height, and the only thing worth scrolling to: the
                    // last message is a moving target while it animates in.
                    Color.clear
                        .frame(height: 1)
                        .id(Self.bottom)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .animation(.spring(response: 0.32, dampingFraction: 0.86), value: conversation.messages)
                .animation(.easeOut(duration: 0.18), value: conversation.isThinking)
            }
            .onChange(of: conversation.messages) { _, _ in scroll(scroller) }
            .onChange(of: conversation.isThinking) { _, _ in scroll(scroller) }
        }
    }

    /// Chases the animation rather than racing it: scrolling on the same run
    /// loop turn as the insertion aims at where the row is now, not where it is
    /// about to settle, and the newest message ends up half off the bottom.
    private func scroll(_ scroller: ScrollViewProxy) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(30))
            withAnimation(.easeOut(duration: 0.24)) {
                scroller.scrollTo(Self.bottom, anchor: .bottom)
            }
        }
    }
}

/// What the panel shows before anything has been said.
///
/// An empty box with a cursor in it tells you nothing about what it accepts, and
/// this box accepts far more than its placeholder can fit.
struct AssistantEmptyState: View {
    let usesStudioBrain: Bool
    let onPick: (String) -> Void

    private var examples: [String] {
        usesStudioBrain
            ? ["Add context", "Change my voice", "Create an idea"]
            : ["Trim the silent gaps", "Add captions", "Cut the retakes"]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(
                usesStudioBrain
                    ? "Change what Yapper knows, or start something anywhere in Studio."
                    : "Ask for an edit, or say where your overlays go."
            )
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                ForEach(examples, id: \.self) { example in
                    Button(example) { onPick(example) }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .padding(.horizontal, 12)
        .padding(.bottom, 10)
    }
}
