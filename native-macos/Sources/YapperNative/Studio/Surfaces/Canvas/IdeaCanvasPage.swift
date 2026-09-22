import SwiftUI

/// One idea, as a canvas. Opened from the Ideas list (and Home); `onBack`
/// returns to where it was opened from.
///
/// Contract shared by the Ideas list and the canvas: this type's name and
/// initializer stay as they are. The body is replaced by the canvas work.
struct IdeaCanvasPage: View {
    let itemID: String
    let onBack: () -> Void

    var body: some View {
        NativePage {
            Button("Ideas", systemImage: "chevron.left", action: onBack)
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            NativeLoadingState(label: "Opening the canvas…")
        }
    }
}
