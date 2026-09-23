import SwiftUI

/// The conversation on this idea, folded under the writing. Clearing it is a
/// fresh start for the talk, not for the page.
struct IdeaCanvasThreadView: View {
    @ObservedObject var thread: IdeaCanvasThreadStore
    @ObservedObject var runner: IdeaCanvasAskRunner

    var body: some View {
        if !thread.messages.isEmpty || thread.failed {
            IdeaCanvasFold(title: "Conversation with Chirpy · \(thread.messages.count)") {
                if !thread.messages.isEmpty {
                    Button("Clear") { Task { await thread.clear() } }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                        .foregroundStyle(.secondary)
                }
            } content: {
                VStack(alignment: .leading, spacing: 12) {
                    if thread.failed {
                        Text("The earlier conversation couldn't be loaded. New asks still work.")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    ForEach(Array(thread.messages.enumerated()), id: \.element.id) { index, message in
                        IdeaCanvasMessageView(
                            message: message,
                            canAddToPage: message.role == .chirpy && message.actions.isEmpty
                                && !runner.addedIDs.contains(message.id),
                            canUndo: runner.undo != nil && runner.undo?.messageID == message.id,
                            onAddToPage: { runner.addToPage(message, asked: asked(before: index)) },
                            onUndo: runner.undoLast
                        )
                    }
                }
            }
        }
    }

    /// The creator's line this reply answered.
    private func asked(before index: Int) -> String {
        thread.messages[..<index].last { $0.role == .creator }?.text ?? ""
    }
}

/// One line of the conversation. Chirpy's carries what it changed and, when
/// it only answered, a way to put that answer on the page.
struct IdeaCanvasMessageView: View {
    let message: IdeaCanvasMessage
    let canAddToPage: Bool
    let canUndo: Bool
    let onAddToPage: () -> Void
    let onUndo: () -> Void

    var body: some View {
        let creator = message.role == .creator
        HStack {
            if creator { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 4) {
                if !creator {
                    Text("Chirpy").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                }
                Text(message.text).font(.system(size: 14)).lineSpacing(3).textSelection(.enabled)
                if !creator && !message.actions.isEmpty {
                    Text(IdeaCanvasActions.describe(message.actions)).font(.system(size: 12)).foregroundStyle(.secondary)
                }
                if !creator && (canAddToPage || canUndo) {
                    HStack(spacing: 4) {
                        if canAddToPage {
                            Button(action: onAddToPage) { Label("Add to page", systemImage: "plus") }
                                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                        }
                        if canUndo {
                            Button(action: onUndo) { Label("Undo this change", systemImage: "arrow.uturn.backward") }
                                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                        }
                    }
                    .foregroundStyle(.secondary)
                    .padding(.leading, -8)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background {
                if creator { RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.studioFaintFill) }
            }
            .opacity(message.pending ? 0.6 : 1)
            if !creator { Spacer(minLength: 40) }
        }
    }
}
