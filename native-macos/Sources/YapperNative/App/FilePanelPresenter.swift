import AppKit

/// Shows an open or save panel as a sheet on the window the creator is
/// working in.
///
/// A free-standing panel reopens where it was last left. After a display was
/// unplugged that was off the screen: the second Import of a session opened at
/// y 1498 on a 1440-point display, out of reach, and pressing Import again
/// showed nothing. A sheet hangs from its window, so it is always where the
/// window is. With no window to hang it from, it runs as a panel centred on
/// the main screen.
@MainActor
enum FilePanelPresenter {
    static func present(_ panel: NSSavePanel) async -> NSApplication.ModalResponse {
        guard let window = hostWindow else {
            if let screen = NSScreen.main {
                let visible = screen.visibleFrame
                panel.setFrameOrigin(NSPoint(x: visible.midX - panel.frame.width / 2,
                                             y: visible.midY - panel.frame.height / 2))
            }
            return panel.runModal()
        }
        return await withCheckedContinuation { continuation in
            panel.beginSheetModal(for: window) { continuation.resume(returning: $0) }
        }
    }

    /// The visible document window that can take a sheet right now: the key
    /// window first, then the main one, then any other.
    private static var hostWindow: NSWindow? {
        guard let app = NSApp else { return nil }
        let candidates = [app.keyWindow, app.mainWindow].compactMap { $0 } + app.windows
        return candidates.first { window in
            window.isVisible && !window.isSheet && window.attachedSheet == nil
                && window.canBecomeMain && !(window is NSPanel)
        }
    }
}
