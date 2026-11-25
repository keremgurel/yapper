import SwiftUI

/// The editor's last status, shown for a moment over the preview instead of
/// as a line of text that sits in the top bar forever.
struct StatusToast: View {
    @ObservedObject var session: EditorSession
    @State private var shown: String?
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        VStack {
            if let shown {
                Text(shown)
                    .font(.studioCaption)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .studioGlass(radius: 999)
                    .transition(.opacity.combined(with: .offset(y: -6)))
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 10)
        .allowsHitTesting(false)
        .animation(.easeOut(duration: 0.18), value: shown)
        .onChange(of: session.statusMessage) { _, message in show(message) }
    }

    private func show(_ message: String) {
        let text = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !session.isBusy else { return }
        shown = text
        hideTask?.cancel()
        hideTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            shown = nil
        }
    }
}
