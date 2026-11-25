import SwiftUI

/// The left side of the editor for the mode it is in.
struct EditorWorkbench: View {
    @ObservedObject var session: EditorSession
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue

    var body: some View {
        if (EditorMode(rawValue: modeRaw) ?? .simple) == .simple {
            SimpleWorkbench(session: session)
        } else {
            WorkbenchPanel(session: session)
        }
    }
}
