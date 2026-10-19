import SwiftUI

/// The left of Chirpy's control row. Usually the cost of sending; while a take
/// runs, its waveform and clock; when a take goes wrong, what happened and the
/// one thing that fixes it.
struct AssistantComposerStatus: View {
    @ObservedObject var dictation: DictationController
    let hint: String
    let onRetryTake: () -> Void
    let onStartTake: () -> Void

    var body: some View {
        if dictation.recording {
            HStack(spacing: 8) {
                DictationWaveform(levels: dictation.levels, height: 18)
                Text(dictation.seconds.dictationClock)
                    .font(.system(size: 10.5).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        } else if let error = dictation.error {
            HStack(spacing: 8) {
                label(error).foregroundStyle(Color.studioDanger)
                Button(fixTitle, action: fix)
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            }
        } else {
            // The hint is a label, not a target: clicking it has to reach the
            // card underneath and put the caret in the text.
            label(dictation.transcribing ? "Transcribing…" : hint)
                .foregroundStyle(.tertiary)
                .allowsHitTesting(false)
        }
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10.5))
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var fixTitle: String {
        if dictation.unsentTake != nil { return "Transcribe again" }
        return dictation.permissionBlocked && dictation.microphoneDenied ? "Open settings" : "Try again"
    }

    private func fix() {
        if dictation.unsentTake != nil { onRetryTake() } else { onStartTake() }
    }
}
