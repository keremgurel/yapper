import SwiftUI

@main
struct YapperNativeApp: App {
    @StateObject private var session = EditorSession()

    var body: some Scene {
        WindowGroup("Yapper Studio Native") {
            AppShellView(session: session)
                .frame(minWidth: 1_100, minHeight: 700)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1_500, height: 950)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Import Media…") { ImportPanels.openMedia(for: session) }
                    .keyboardShortcut("i")
                Button("Export…") { ImportPanels.saveExport(for: session) }
                    .keyboardShortcut("e")
            }
            CommandMenu("Edit") {
                Button("Split at Playhead") {
                    Task { await session.splitAtPlayhead() }
                }
                .keyboardShortcut("b")
                Button("Delete Selected Clip") {
                    Task { await session.deleteSelected() }
                }
                .keyboardShortcut(.delete, modifiers: [])
            }
            CommandMenu("Playback") {
                Button(session.isPlaying ? "Pause" : "Play") {
                    session.togglePlayback()
                }
                .keyboardShortcut(.space, modifiers: [])
            }
        }
    }
}
