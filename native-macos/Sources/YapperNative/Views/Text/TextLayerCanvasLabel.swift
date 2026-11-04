import SwiftUI

/// A text layer's words at the size they take on the stage.
///
/// The canvas item draws it; the selection chrome draws it hidden, purely to
/// be the same size, so the outline and the corners sit on the card without
/// either side measuring the other.
struct TextLayerCanvasLabel: View {
    let layer: ProjectTextLayer
    let canvasSize: CGSize

    var body: some View {
        AppearanceText(
            text: layer.text.isEmpty ? "Text" : layer.text,
            appearance: layer.appearance,
            fontSize: max(11, canvasSize.height * layer.fontScale),
            lineLimit: 5,
            minimumScaleFactor: 0.45
        )
        .frame(width: max(60, canvasSize.width * layer.width))
    }
}

/// How a text layer gesture ends: the finished draft is committed through the
/// text actions and stays on screen until the edit lands, so the layer does
/// not jump back.
@MainActor
enum TextLayerCanvasCommit {
    static func commit(_ finished: ProjectTextLayer, session: EditorSession, drag: CanvasDragState) {
        let commit = session.commitTextLayerDraft(finished)
        Task { _ = await commit.value; drag.releaseText(finished.id) }
    }

    /// How far a drag in flight has carried the layer from where it is saved.
    /// The saved position places it; the drag is a transform on top.
    static func dragOffset(for layer: ProjectTextLayer, drag: CanvasDragState, canvasSize: CGSize) -> CGSize {
        guard let draft = drag.textDraft(for: layer.id) else { return .zero }
        return CGSize(
            width: (draft.x - layer.x) * canvasSize.width,
            height: (draft.y - layer.y) * canvasSize.height
        )
    }
}
