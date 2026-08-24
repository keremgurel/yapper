import AppKit
import Foundation

extension EditorSession {
    func copyTranscript(keptOnly: Bool) {
        let value = keptOnly ? project.keptTranscriptText : project.fullTranscriptText
        guard !value.isEmpty else {
            setStatus("There is no transcript to copy")
            return
        }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(value, forType: .string)
        setStatus(keptOnly ? "Copied kept transcript" : "Copied full transcript")
    }
}
