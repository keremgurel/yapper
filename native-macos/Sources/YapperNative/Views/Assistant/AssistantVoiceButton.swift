import SwiftUI

/// The mic beside Chirpy's send button. Tap to talk, tap again to drop the
/// words into the box. Sized and shaped like the send button so the two read
/// as one pair.
struct AssistantVoiceButton: View {
    @ObservedObject var dictation: DictationController
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Group {
                if dictation.transcribing {
                    ProgressView().controlSize(.small).scaleEffect(0.72)
                } else {
                    Image(systemName: dictation.recording ? "stop.fill" : "mic")
                        .font(.system(size: dictation.recording ? 9 : 12, weight: .semibold))
                        .foregroundStyle(dictation.recording ? Color.primary : Color.secondary)
                }
            }
            .frame(width: 24, height: 24)
            .background(fill, in: Circle())
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .clickableCursor(enabled: !dictation.transcribing)
        .disabled(dictation.transcribing)
        .help(help)
        .accessibilityLabel(dictation.recording ? "Stop dictating" : "Dictate")
    }

    private var fill: Color {
        if dictation.recording { return .studioFaintFill }
        return isHovering ? Color.studioFaintFill.opacity(0.7) : .clear
    }

    private var help: String {
        if dictation.recording { return "Stop and keep the words in the box (⌘D)" }
        if dictation.permissionBlocked && dictation.microphoneDenied { return "Open microphone settings" }
        return "Dictate (⌘D)"
    }
}
