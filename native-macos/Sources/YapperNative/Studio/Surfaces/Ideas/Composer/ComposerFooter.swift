import SwiftUI

/// The composer's bottom row: what is happening (or the shortcuts), then
/// grow, dictate or stop, and bank it. Banking is the page's one primary
/// action.
struct ComposerFooter: View {
    let expanded: Bool
    let onToggleExpanded: () -> Void
    @ObservedObject var actions: ComposerActions = .shared
    @ObservedObject var dictation: DictationController = .shared
    @ObservedObject var draft: CaptureDraft = .shared

    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            if !dictation.recording { ComposerFormatMenu() }
            status.frame(maxWidth: .infinity, alignment: dictation.recording ? .leading : .trailing)
            iconButton(expanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right",
                       help: expanded ? "Back to the page (Esc)" : "Write full screen", action: onToggleExpanded)
            voiceButton
            Button { Task { await actions.submit() } } label: {
                Group {
                    if actions.saving { ProgressView().controlSize(.small) } else { Image(systemName: "arrow.up").font(.system(size: 14, weight: .semibold)) }
                }
                .frame(width: 18)
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(!actions.canSubmit)
            .help("Add to your ideas (⌘Return)")
            .accessibilityLabel("Add to your ideas")
        }
        .frame(minHeight: 40)
    }

    @ViewBuilder
    private var status: some View {
        if dictation.recording {
            HStack(spacing: 12) {
                DictationWaveform(levels: dictation.levels)
                Text(dictation.seconds.dictationClock)
                    .font(.system(size: 13).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .trailing)
            }
            .padding(.leading, 6)
        } else {
            HStack(spacing: 8) {
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(actions.captureError != nil || dictation.error != nil ? Color.studioDanger : .secondary)
                    .lineLimit(2)
                if actions.captureError != nil {
                    Button("Try again") { Task { await actions.submit() } }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                        .disabled(actions.saving)
                } else if dictation.error != nil {
                    Button(dictation.permissionBlocked && dictation.microphoneDenied ? "Open settings" : "Try again") {
                        Task { await actions.toggleVoice() }
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .disabled(actions.saving)
                }
            }
        }
    }

    private var message: String {
        if let error = actions.captureError { return error }
        if let error = dictation.error { return error }
        if dictation.transcribing { return "Transcribing your thought…" }
        if actions.saving { return "Saving your idea…" }
        return "⌘D to dictate · ⌘Return to bank it"
    }

    @ViewBuilder
    private var voiceButton: some View {
        if dictation.recording {
            iconButton("stop.fill", help: "Stop dictating (⌘D)") { Task { await actions.finishTake() } }
                .keyboardShortcut("d", modifiers: .command)
                .disabled(actions.saving)
        } else {
            Button { Task { await actions.toggleVoice() } } label: {
                Group {
                    if dictation.transcribing { ProgressView().controlSize(.small) } else { Image(systemName: "mic") }
                }
                .font(.system(size: 15))
                .frame(width: 20, height: 20)
            }
            .buttonStyle(EditorGhostButtonStyle(size: .regular))
            .keyboardShortcut("d", modifiers: .command)
            .disabled(dictation.transcribing || actions.saving)
            .help("Dictate an idea (⌘D)")
            .accessibilityLabel("Dictate an idea")
        }
    }

    private func iconButton(_ symbol: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 14)).frame(width: 20, height: 20)
        }
        .buttonStyle(EditorGhostButtonStyle(size: .regular))
        .help(help)
        .accessibilityLabel(help)
    }
}
