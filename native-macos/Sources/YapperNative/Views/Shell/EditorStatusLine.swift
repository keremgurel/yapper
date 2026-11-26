import SwiftUI

/// What the editor is doing, in the middle of the top bar. A running job
/// stays with its spinner and Cancel; a finished one says so for a few
/// seconds and fades, so the bar never holds a stale line.
struct EditorStatusLine: View {
    @ObservedObject var session: EditorSession
    @State private var shown: String?
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        HStack(spacing: 8) {
            if session.managedMediaStatus != nil {
                ManagedMediaNotice(session: session)
            } else if let text = session.isBusy ? session.statusMessage : shown {
                if session.isBusy { ProgressView().controlSize(.small) }
                Text(text)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(text)
                    .transition(.opacity)
                if session.canCancelCurrentOperation, let operation = session.activeOperation?.operation {
                    Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: shown)
        .onChange(of: session.statusMessage) { _, message in flash(message) }
        .onChange(of: session.isBusy) { _, busy in if !busy { flash(session.statusMessage) } }
    }

    private func flash(_ message: String) {
        let text = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        shown = text
        hideTask?.cancel()
        hideTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            shown = nil
        }
    }
}
