import SwiftUI

/// Asking Chirpy from the canvas: a field that rises from the bottom when
/// "Ask Chirpy" is pressed. It can be aimed at one block, shows what Chirpy
/// said, and offers to undo the change it just made.
struct IdeaCanvasAskBar: View {
    @ObservedObject var bar: IdeaCanvasAskBarState
    @ObservedObject var runner: IdeaCanvasAskRunner
    let blocks: [IdeaCanvasBlock]
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let target = targetBlock {
                HStack(spacing: 6) {
                    Text("Changing \(target.label.isEmpty ? "this part" : target.label)")
                        .font(.system(size: 12, weight: .medium))
                    Button { bar.targetID = nil } label: { Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)) }
                        .buttonStyle(.studioPlain)
                        .help("Ask about the whole piece instead")
                }
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10).frame(height: 24)
                .background(Capsule().fill(Color.studioFaintFill))
            }
            HStack(spacing: 8) {
                Image(systemName: "sparkles").foregroundStyle(.secondary)
                TextField("Ask Chirpy to change this piece", text: $bar.draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .lineLimit(1...4)
                    .focused($focused)
                    .onSubmit(send)
                    .disabled(runner.busy)
                if runner.busy {
                    ProgressView().controlSize(.small)
                } else {
                    Button("Ask", action: send)
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                        .disabled(bar.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Button { bar.close() } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .medium)) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .help("Close (Esc)")
            }
            status
        }
        .padding(14)
        .frame(maxWidth: 680)
        .background(NativeCardBackground(radius: 14))
        .onChange(of: bar.focusRequest) { _, _ in focused = true }
        .onAppear { focused = true }
    }

    @ViewBuilder private var status: some View {
        if let error = runner.error {
            Text(error.message).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
        } else if runner.busy {
            Text("Chirpy is working on it…").font(.system(size: 12)).foregroundStyle(.secondary)
        } else if let reply = runner.lastReply {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(reply).font(.system(size: 13)).lineLimit(3).frame(maxWidth: .infinity, alignment: .leading)
                if runner.undo != nil {
                    Button(action: runner.undoLast) { Label("Undo", systemImage: "arrow.uturn.backward") }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                }
            }
        }
    }

    private var targetBlock: IdeaCanvasBlock? {
        bar.targetID.flatMap { id in blocks.first { $0.id == id } }
    }

    private func send() {
        let instruction = bar.draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !instruction.isEmpty, !runner.busy else { return }
        let target = bar.targetID
        bar.draft = ""
        bar.targetID = nil
        Task { await runner.run(instruction, targetID: target) }
    }
}
