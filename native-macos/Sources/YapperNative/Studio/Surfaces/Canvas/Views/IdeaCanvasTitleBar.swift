import SwiftUI

/// What the title bar can do, handed down by the page.
struct IdeaCanvasTitleBarActions {
    let back: () -> Void
    let askChirpy: () -> Void
    let record: () -> Void
    let delete: () -> Void
    let sendToPhone: () -> Void
    let copyScript: () -> Void
    let editOnMac: () -> Void
    let crossPost: () -> Void
    let toggleMaximized: () -> Void
}

/// The document's title bar: its name, then what you do to it besides
/// writing. Record is the one primary action.
struct IdeaCanvasTitleBar: View {
    @ObservedObject var store: IdeaCanvasItemStore
    let busy: Bool
    let maximized: Bool
    let actions: IdeaCanvasTitleBarActions

    var body: some View {
        if let item = store.item {
            HStack(spacing: 8) {
                Button(action: actions.back) {
                    Image(systemName: "chevron.left").font(.system(size: 13, weight: .medium))
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .help("Back to Ideas")
                .disabled(busy)

                TextField("Untitled", text: Binding(
                    get: { item.title },
                    set: { store.update(IdeaCanvasPatch(title: $0)) }
                ))
                .textFieldStyle(.plain)
                .font(.system(size: 15, weight: .semibold))
                .frame(minWidth: 120, maxWidth: .infinity)

                IdeaCanvasSaveIndicator(autosave: store.autosave)

                Button(action: actions.askChirpy) {
                    Label("Ask Chirpy", systemImage: "sparkles")
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .help("Ask Chirpy to change this piece")

                IdeaCanvasStatusMenu(status: item.status) { store.update(IdeaCanvasPatch(status: $0)) }

                Button(action: actions.record) {
                    Label(item.submissionId == nil ? "Record" : "Record again", systemImage: "video")
                }
                .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                .disabled(busy)

                IdeaCanvasDeleteControl(disabled: busy, onConfirm: actions.delete)

                IdeaCanvasMoreMenu(
                    hasRecording: item.submissionId != nil,
                    onSendToPhone: actions.sendToPhone,
                    onCopyScript: actions.copyScript,
                    onEditOnMac: actions.editOnMac,
                    onCrossPost: actions.crossPost
                )
                .disabled(busy)

                Button(action: actions.toggleMaximized) {
                    Image(systemName: maximized
                          ? "arrow.down.right.and.arrow.up.left"
                          : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .help(maximized ? "Back to Studio (Esc)" : "Give the canvas the window")
            }
            .padding(.horizontal, 20)
            .frame(height: 56)
            .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
        }
    }
}
