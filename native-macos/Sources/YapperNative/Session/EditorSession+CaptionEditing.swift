import Foundation

/// Caption content: what the cards say, how many there are, and where they
/// start and end.
extension EditorSession {
    func setCaptionText(_ text: String, for id: UUID) {
        guard project.caption(withID: id)?.text != text else { return }
        scheduleVisualCommit { [self] in
            updateProject { $0.setCaptionText(text, for: id) }
            return true
        }
    }

    func addCaptionAtPlayhead() async {
        guard !project.clips.isEmpty else { return }
        await performAppAction(CaptionAddInput(at: .playhead, afterCaptionID: nil, text: nil))
    }

    /// Return at the end of a card: a new one after it, selected, ready to type
    /// into. What Return does everywhere else a list of lines is edited.
    @discardableResult
    func addCaption(after id: UUID) async -> UUID? {
        let result = await performAppAction(CaptionAddInput(at: nil, afterCaptionID: id, text: nil))
        return result.status == .applied ? result.changes.first?.targetID : nil
    }

    func removeCaption(_ id: UUID) async {
        guard project.caption(withID: id) != nil else { return }
        await performAppAction(CaptionRemoveInput(captionIDs: [id]))
    }

    var canMergeSelectedCaptions: Bool { selectedCaptionIDs.count >= 2 }

    func mergeSelectedCaptions() async {
        guard canMergeSelectedCaptions else { return }
        await performAppAction(CaptionMergeInput(captionIDs: selectedCaptionIDs.sorted { $0.uuidString < $1.uuidString }))
    }

    /// Backspace at the very start of a caption row folds it into the row
    /// above, the mirror of Return splitting one in two. Returns the surviving
    /// caption so the caller can keep editing where the text landed.
    @discardableResult
    func mergeCaptionIntoPrevious(_ id: UUID) async -> UUID? {
        let ordered = captions
        guard let index = ordered.firstIndex(where: { $0.id == id }), index > 0 else { return nil }
        let previous = ordered[index - 1]
        let result = await performAppAction(CaptionMergeInput(captionIDs: [previous.id, id]))
        guard result.status == .applied else { return nil }
        return result.changes.first.flatMap { UUID(uuidString: $0.after) } ?? previous.id
    }

    /// Enter in a caption row cuts it at the cursor's word boundary.
    func splitCaption(_ id: UUID, afterWords wordsBefore: Int) async -> UUID? {
        var tailID: UUID?
        let success = await commitTimelineEdit(
            requiresRebuild: false,
            successStatus: "Caption split"
        ) { [self] in
            updateProject { tailID = $0.splitCaption(id, afterWords: wordsBefore) }
            guard let tailID else { return false }
            setSelectedCaptionIDs([tailID])
            return true
        }
        return success ? tailID : nil
    }

    func clearAllCaptions() async {
        guard hasCaptions || project.captionsEnabled == true else { return }
        await commitTimelineEdit(requiresRebuild: false, successStatus: "Captions cleared") { [self] in
            updateProject { $0.clearCaptions() }
            setSelectedCaptionIDs([])
            return true
        }
    }
}
