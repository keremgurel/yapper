import SwiftUI

/// One idea, as a canvas. Opened from the Ideas list (and Home); `onBack`
/// returns to where it was opened from.
///
/// Contract shared by the Ideas list and the canvas: this type's name and
/// initializer stay as they are. The canvas itself is `IdeaCanvasScreen`.
struct IdeaCanvasPage: View {
    let itemID: String
    let onBack: () -> Void

    var body: some View {
        IdeaCanvasScreen(itemID: itemID, onBack: onBack)
            .id(itemID)
    }
}
