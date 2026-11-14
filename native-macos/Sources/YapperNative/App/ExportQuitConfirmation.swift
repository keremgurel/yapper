import AppKit

/// Quitting stops every export still running, and an export in the
/// background is easy to forget. Ask first.
@MainActor
enum ExportQuitConfirmation {
    static func allowsQuit(_ running: [ExportJob]) -> Bool {
        guard !running.isEmpty else { return true }
        let copy = ExportQuitCopy(running)
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = copy.title
        alert.informativeText = copy.detail
        alert.addButton(withTitle: "Keep exporting")
        alert.addButton(withTitle: "Quit anyway")
        return alert.runModal() == .alertSecondButtonReturn
    }
}

/// What the quit alert says. A render that stops leaves nothing behind, but an
/// upload that stops may already have reached Poster, so the two are told
/// apart.
struct ExportQuitCopy: Equatable {
    let title: String
    let detail: String

    init(_ running: [ExportJob]) {
        let uploading = running.filter { if case .posting = $0.state { true } else { false } }.count
        let rendering = running.count - uploading
        title = running.count == 1
            ? "An export is still running"
            : "\(running.count) exports are still running"
        var sentences: [String] = []
        switch rendering {
        case 0: break
        case 1: sentences.append("Quitting stops the render and removes its unfinished file. A file it was replacing stays as it was.")
        default: sentences.append("Quitting stops the renders and removes their unfinished files. Files they were replacing stay as they were.")
        }
        switch uploading {
        case 0: break
        case 1: sentences.append("An upload to Poster stops partway. Poster may already have that video, so check Poster before you post it again.")
        default: sentences.append("\(uploading) uploads to Poster stop partway. Poster may already have those videos, so check Poster before you post them again.")
        }
        detail = sentences.joined(separator: " ")
    }
}
