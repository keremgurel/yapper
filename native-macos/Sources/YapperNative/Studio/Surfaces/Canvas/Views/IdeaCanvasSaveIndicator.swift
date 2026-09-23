import SwiftUI

/// Autosave status. Silent when nothing has been edited yet.
struct IdeaCanvasSaveIndicator: View {
    @ObservedObject var autosave: IdeaCanvasAutosave

    var body: some View {
        switch autosave.state {
        case .idle:
            EmptyView()
        case .saving:
            label("Saving…", color: .secondary)
        case .saved:
            label("Saved", color: .secondary)
        case .error:
            label("Save failed", color: .studioDanger)
        }
    }

    private func label(_ text: String, color: Color) -> some View {
        Text(text).font(.system(size: 12, weight: .medium)).foregroundStyle(color).fixedSize()
    }
}
