import AppKit
import Foundation

/// A value snapshot, so editing or deleting the original does not change a copy.
/// Project-local media references remain valid only in their source project.
struct TimelineAudioClipboard: Codable {
    static let pasteboardType = NSPasteboard.PasteboardType("com.yapper.timeline-audio")
    let projectID: UUID
    let layer: ProjectAudioLayer
}

@MainActor
extension EditorSession {
    var canCopyTimelineAudio: Bool {
        guard let layer = selectedAudioLayer else { return false }
        return timelineSelection == [.audio(layer.id)]
    }

    @discardableResult
    func copyTimelineAudio() -> Bool {
        let pasteboard = timelinePasteboard
        guard canCopyTimelineAudio, let layer = selectedAudioLayer,
              let data = try? JSONEncoder().encode(
                TimelineAudioClipboard(projectID: project.id, layer: layer)
              ) else { return false }
        pasteboard.clearContents()
        guard pasteboard.setData(data, forType: TimelineAudioClipboard.pasteboardType) else { return false }
        setStatus("Copied \(layer.name) · ⌘V to paste at the playhead")
        return true
    }

    func canPasteTimelineAudio() -> Bool {
        !isBusy && duration > 0 && copiedTimelineAudio() != nil
    }

    /// The sound on the clipboard, when it was copied from this project.
    func copiedTimelineAudio() -> TimelineAudioClipboard? {
        guard let data = timelinePasteboard.data(forType: TimelineAudioClipboard.pasteboardType),
              let copy = try? JSONDecoder().decode(TimelineAudioClipboard.self, from: data),
              copy.projectID == project.id,
              copy.layer.duration.isFinite, copy.layer.duration > 0,
              copy.layer.sourceStart.isFinite, copy.layer.sourceStart >= 0
        else { return nil }
        return copy
    }

    /// ⌘V on the timeline: the copied sound at the playhead, through the
    /// paste action Chirpy uses.
    @discardableResult
    func pasteTimelineAudio() async -> Bool {
        guard canPasteTimelineAudio(), currentTime.isFinite else { return false }
        // Capture the cursor before waiting for another edit to finish.
        return await performAppAction(AudioPasteInput(at: .time(currentTime))).status == .applied
    }
}
