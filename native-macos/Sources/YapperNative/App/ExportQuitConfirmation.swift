import AppKit

/// Quitting stops every export still running, and an export in the
/// background is easy to forget. Ask first.
@MainActor
enum ExportQuitConfirmation {
    static func allowsQuit(running: Int) -> Bool {
        guard running > 0 else { return true }
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = running == 1
            ? "An export is still running"
            : "\(running) exports are still running"
        alert.informativeText = running == 1
            ? "Quitting stops it before it saves anything. A file it was replacing stays as it was."
            : "Quitting stops them before they save anything. Files they were replacing stay as they were."
        alert.addButton(withTitle: "Keep exporting")
        alert.addButton(withTitle: "Quit anyway")
        return alert.runModal() == .alertSecondButtonReturn
    }
}
