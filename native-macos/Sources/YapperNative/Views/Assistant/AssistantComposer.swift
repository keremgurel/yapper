import SwiftUI

/// The thing you type into, at the foot of the conversation.
///
/// One surface, not two. The box used to be a card sitting inside a bar with its
/// own padding, its own border and a button parked outside it, which spent most
/// of the panel's width on margins and left the send button floating in a strip
/// of its own. Here the text, the hint and the send button share a single card:
/// the text takes all the room, the controls sit on its bottom edge, and the
/// whole card is the click target.
struct AssistantComposer: View {
    @ObservedObject var session: EditorSession
    @Binding var instruction: String
    @Binding var caret: Int
    let placeholder: String
    let isWorking: Bool
    /// Bumped when the card is clicked anywhere, so the caret goes into the
    /// text rather than nowhere.
    @Binding var focusRequest: Int
    let onListKey: (MentionTextView.ListKey) -> Bool
    let onEscape: () -> Void
    let onSend: () -> Void

    /// The example it shows when empty. An overlay one, because overlays are
    /// the hardest thing to ask for in words — but nothing here refuses a
    /// sentence about anything else the editor can do.
    static let placeholder = "Show @01-hook.png while I say what the video is about"
    static let studioPlaceholder = "Add context, change my Brain, or create an idea…"

    private var isEmpty: Bool {
        instruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSend: Bool {
        !isWorking && !isEmpty
            && (session.assistantUsesStudioBrain || !session.project.clips.isEmpty)
    }

    var body: some View {
        VStack(spacing: 0) {
            MentionTextView(
                text: $instruction,
                caret: $caret,
                placeholder: placeholder,
                focusRequest: focusRequest,
                onListKey: onListKey,
                onEscape: onEscape,
                onSubmit: onSend
            )
            .frame(minHeight: 46)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            controls
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 6)
        // Anywhere on the card puts the caret in the text: the padding, the
        // hint line and the gap beside the button are all part of the box as
        // far as anyone using it is concerned.
        //
        // It has to be the *background* that takes that click, never the card
        // itself. A tap gesture on the card sits above the text view and claims
        // the click before AppKit ever sees it, which stopped the box taking
        // the caret at all — including by clicking straight on the words.
        // Behind the content, the text view and the send button take their own
        // clicks first and only what falls between them lands here.
        .background {
            Color.studioInputBackground
                .contentShape(Rectangle())
                .onTapGesture { focusRequest += 1 }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.studioLine, lineWidth: 1)
                .allowsHitTesting(false)
        }
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Text(
                isEmpty
                    ? (session.assistantUsesStudioBrain ? "Ask across Studio" : "@ to name a file")
                    : "⏎ send · ⇧⏎ new line"
            )
                .font(.system(size: 10.5))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
                // The hint is a label, not a target: clicking it has to reach
                // the card underneath and put the caret in the text.
                .allowsHitTesting(false)

            Spacer(minLength: 8)

            sendButton
        }
        .frame(height: 24)
    }

    private var sendButton: some View {
        Button(action: onSend) {
            Group {
                if isWorking {
                    ProgressView().controlSize(.small).scaleEffect(0.72)
                } else {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(canSend ? Color.black : Color.secondary)
                }
            }
            .frame(width: 24, height: 24)
            .background(canSend ? Color.yapperOrange : Color.studioFaintFill, in: Circle())
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
        .help(
            !session.assistantUsesStudioBrain && session.project.clips.isEmpty
                ? "Import a video first"
                : "Send · ⏎"
        )
        .animation(.easeOut(duration: 0.14), value: canSend)
    }
}
