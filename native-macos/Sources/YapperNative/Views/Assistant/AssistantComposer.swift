import SwiftUI

/// The thing you type or talk into, at the foot of the conversation.
///
/// One surface, not two. The box used to be a card sitting inside a bar with its
/// own padding, its own border and a button parked outside it, which spent most
/// of the panel's width on margins and left the send button floating in a strip
/// of its own. Here the text, the hint, the mic and the send button share a
/// single card: the text takes all the room, the controls sit on its bottom
/// edge, and the whole card is the click target.
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
    /// Chirpy's own take, so talking here never lights up the idea composer
    /// that may be sitting behind the panel.
    @StateObject private var dictation = DictationController()

    /// The example it shows when empty. An overlay one, because overlays are
    /// the hardest thing to ask for in words — but nothing here refuses a
    /// sentence about anything else the editor can do.
    static let placeholder = "Show @01-hook.png while I say what the video is about"
    static let studioPlaceholder = "Add context, change my Brain, or create an idea…"

    private var isEmpty: Bool {
        instruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSend: Bool {
        !isWorking && !dictation.transcribing
            && (dictation.recording || !isEmpty)
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
                onEscape: escape,
                onDictate: { Task { await toggleVoice() } },
                onSubmit: submit
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
        // The panel is torn down when it closes. A take still running then
        // has nowhere to put its words, so it goes too.
        .onDisappear { dictation.cancel() }
    }

    private var controls: some View {
        HStack(spacing: 6) {
            AssistantComposerStatus(
                dictation: dictation,
                hint: session.assistantUsesStudioBrain && IdeaCanvasFocus.shared.runner != nil
                    ? "1 credit per idea edit"
                    : "2 credits to plan · generation costs extra",
                onRetryTake: { Task { insert(await dictation.retryUnsentTake()) } },
                onStartTake: { Task { await toggleVoice() } }
            )
            .frame(maxWidth: .infinity, alignment: .leading)

            AssistantVoiceButton(dictation: dictation) { Task { await toggleVoice() } }
            sendButton
        }
        .frame(minHeight: 24)
    }

    private func toggleVoice() async {
        insert(await dictation.toggle())
    }

    /// Return and the send button both land here. Sending mid-take means
    /// "send what I just said"; a silent or failed take leaves the box alone.
    private func submit() {
        Task {
            guard !isWorking, !dictation.transcribing else { return }
            if dictation.recording, !insert(await dictation.stop()) { return }
            onSend()
        }
    }

    /// Escape throws a running take away before it means "put Chirpy away".
    private func escape() {
        guard dictation.recording else { return onEscape() }
        dictation.cancel()
        focusRequest += 1
    }

    /// Puts dictated words in at the caret and the caret just past them.
    @discardableResult
    private func insert(_ heard: String?) -> Bool {
        guard let heard else { return false }
        let result = DictationInsertion.insert(heard, into: instruction, selection: NSRange(location: caret, length: 0))
        instruction = result.text
        caret = result.caret
        focusRequest += 1
        return true
    }

    private var sendButton: some View {
        Button(action: submit) {
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
        .help(sendHelp)
        .animation(.easeOut(duration: 0.14), value: canSend)
    }

    private var sendHelp: String {
        if !session.assistantUsesStudioBrain && session.project.clips.isEmpty { return "Import a video first" }
        if dictation.recording { return "Send what you said · ⏎" }
        return "Send · ⏎ · 2 credits to plan. Generation workflows have their usual additional charges."
    }
}
