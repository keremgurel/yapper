import SwiftUI

/// The preview. Chirpy lives in the Edit pane, so the preview keeps its full
/// height in both modes.
struct EditorPreviewColumn: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode

    var body: some View {
        PlayerPanel(session: session, layoutMode: layoutMode)
    }
}
