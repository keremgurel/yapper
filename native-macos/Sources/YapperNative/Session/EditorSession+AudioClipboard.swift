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
    func copyTimelineAudio(to pasteboard: NSPasteboard = .general) -> Bool {
        guard canCopyTimelineAudio, let layer = selectedAudioLayer,
              let data = try? JSONEncoder().encode(
                TimelineAudioClipboard(projectID: project.id, layer: layer)
              ) else { return false }
        pasteboard.clearContents()
        guard pasteboard.setData(data, forType: TimelineAudioClipboard.pasteboardType) else { return false }
        setStatus("Copied \(layer.name) · ⌘V to paste at the playhead")
        return true
    }

    func canPasteTimelineAudio(from pasteboard: NSPasteboard = .general) -> Bool {
        !isBusy && duration > 0 && copiedTimelineAudio(from: pasteboard) != nil
    }

    private func copiedTimelineAudio(from pasteboard: NSPasteboard) -> TimelineAudioClipboard? {
        guard let data = pasteboard.data(forType: TimelineAudioClipboard.pasteboardType),
              let copy = try? JSONDecoder().decode(TimelineAudioClipboard.self, from: data),
              copy.projectID == project.id,
              copy.layer.duration.isFinite, copy.layer.duration > 0,
              copy.layer.sourceStart.isFinite, copy.layer.sourceStart >= 0
        else { return nil }
        return copy
    }

    @discardableResult
    func pasteTimelineAudio(from pasteboard: NSPasteboard = .general) async -> Bool {
        guard canPasteTimelineAudio(from: pasteboard),
              let copy = copiedTimelineAudio(from: pasteboard), currentTime.isFinite
        else { return false }
        // Capture the cursor before waiting for another edit to finish.
        let time = currentTime
        return await commitTimelineEdit(successStatus: "Pasted \(copy.layer.name) · ⌘Z to undo") {
            guard project.id == copy.projectID, duration > 0 else { return false }
            var layer = copy.layer
            layer.id = UUID()
            layer.timelineStart = min(max(0, time), max(0, duration - 0.02))
            layer.duration = min(layer.duration, duration - layer.timelineStart)
            updateProject { project in
                project.audioLayers = (project.audioLayers ?? []) + [layer]
            }
            selectAudioLayer(layer.id)
            return true
        }
    }
}
