import SwiftUI

/// The preview, and in Simple mode Chirpy docked under it.
struct EditorPreviewColumn: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue

    private var isSimple: Bool { (EditorMode(rawValue: modeRaw) ?? .simple) == .simple }

    var body: some View {
        VStack(spacing: 0) {
            PlayerPanel(session: session, layoutMode: layoutMode)
            if isSimple {
                ChirpyDock(session: session, conversation: session.conversation)
            }
        }
    }
}
