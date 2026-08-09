import SwiftUI

@main
struct YapperNativeApp: App {
    @StateObject private var session = EditorSession()
    @AppStorage("studioColorScheme") private var themeRaw = StudioTheme.dark.rawValue

    private var theme: StudioTheme {
        StudioTheme(rawValue: themeRaw) ?? .dark
    }

    var body: some Scene {
        WindowGroup("Yapper Studio Native") {
            AppShellView(session: session)
                .frame(minWidth: 1_100, minHeight: 700)
                .preferredColorScheme(theme.colorScheme)
                .onOpenURL { url in
                    NativeAuthHandoff.shared.receive(url)
                }
        }
        .defaultSize(width: 1_500, height: 950)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .undoRedo) {
                Button("Undo") {
                    Task { await session.undo() }
                }
                .keyboardShortcut("z", modifiers: [.command])
                .disabled(!session.canUndo || session.isBusy || session.isExporting)

                Button("Redo") {
                    Task { await session.redo() }
                }
                .keyboardShortcut("z", modifiers: [.command, .shift])
                .disabled(!session.canRedo || session.isBusy || session.isExporting)
            }
            CommandGroup(after: .toolbar) {
                Button(session.isAssistantOpen ? "Hide Yapper" : "Ask Yapper") {
                    session.toggleAssistant()
                }
                .keyboardShortcut("k", modifiers: [.command])
            }
            CommandGroup(after: .newItem) {
                Button("Import Media…") { ImportPanels.openMedia(for: session) }
                    .keyboardShortcut("i")
                Button("Export…") { ImportPanels.saveExport(for: session) }
                    .keyboardShortcut("e")
            }
            CommandMenu("Timeline") {
                Button("Split at Playhead") {
                    Task { await session.splitAtPlayhead() }
                }
                Button("Delete Selected Items") {
                    Task { await session.deleteTimelineSelection() }
                }
                Divider()
                Button("Trim Left Edge to Playhead") {
                    Task { await session.trimTimelineSelection(toPlayhead: .leading) }
                }
                Button("Trim Right Edge to Playhead") {
                    Task { await session.trimTimelineSelection(toPlayhead: .trailing) }
                }
                Divider()
                Button("Auto-trim Silent Gaps") {
                    Task { await session.autoTrimSilences() }
                }
                .keyboardShortcut("t", modifiers: [.command, .shift])
            }
            CommandMenu("Playback") {
                // No key equivalent on purpose. Space is handled by the
                // timeline's key monitor, which checks what has the keyboard
                // first; a menu shortcut fires whatever is focused, so the two
                // together toggled playback twice and it looked stuck.
                Button(session.isPlaying ? "Pause" : "Play") {
                    session.togglePlayback()
                }
            }
        }
    }
}
