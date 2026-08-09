import Foundation

/// Caption content: what the cards say, how many there are, and where they
/// start and end.
extension EditorSession {
    func setCaptionText(_ text: String, for id: UUID) {
        guard project.caption(withID: id)?.text != text else { return }
        let undoSnapshot = project
        updateProject { $0.setCaptionText(text, for: id) }
        scheduleVisualCommit(undoSnapshot: undoSnapshot)
    }

    func addCaptionAtPlayhead() {
        guard !project.clips.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()
        var created: ProjectCaption?
        updateProject { created = $0.addCaption(atTimelineTime: currentTime) }
        guard let created else { return }
        setSelectedCaptionIDs([created.id])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Caption added")
        }
    }

    /// Return at the end of a card: a new one after it, selected, ready to type
    /// into. What Return does everywhere else a list of lines is edited.
    @discardableResult
    func addCaption(after id: UUID) -> UUID? {
        let undoSnapshot = prepareUndoSnapshot()
        var created: ProjectCaption?
        updateProject { created = $0.addCaption(after: id) }
        guard let created else { return nil }
        setSelectedCaptionIDs([created.id])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
        }
        return created.id
    }

    func removeCaption(_ id: UUID) {
        guard project.caption(withID: id) != nil else { return }
        let undoSnapshot = prepareUndoSnapshot()
        updateProject { $0.removeCaption(id) }
        var ids = selectedCaptionIDs
        ids.remove(id)
        setSelectedCaptionIDs(ids)
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Caption deleted")
        }
    }

    var canMergeSelectedCaptions: Bool { selectedCaptionIDs.count >= 2 }

    func mergeSelectedCaptions() {
        guard canMergeSelectedCaptions else { return }
        let merging = selectedCaptionIDs
        let undoSnapshot = prepareUndoSnapshot()
        updateProject { $0.mergeCaptions(merging) }
        setSelectedCaptionIDs([])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Merged \(merging.count) captions")
        }
    }

    /// Backspace at the very start of a caption row folds it into the row
    /// above, the mirror of Return splitting one in two. Returns the surviving
    /// caption so the caller can keep editing where the text landed.
    @discardableResult
    func mergeCaptionIntoPrevious(_ id: UUID) -> UUID? {
        let ordered = captions
        guard
            let index = ordered.firstIndex(where: { $0.id == id }),
            index > 0
        else { return nil }
        let previous = ordered[index - 1]
        let undoSnapshot = prepareUndoSnapshot()
        updateProject { $0.mergeCaptions([previous.id, id]) }
        // The merge mints no new id: the survivor keeps the earlier card's.
        let survivor = captions.first { $0.sourceStart == previous.sourceStart }?.id ?? previous.id
        setSelectedCaptionIDs([survivor])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Captions merged")
        }
        return survivor
    }

    /// Enter in a caption row cuts it at the cursor's word boundary.
    func splitCaption(_ id: UUID, afterWords wordsBefore: Int) {
        let undoSnapshot = prepareUndoSnapshot()
        var tailID: UUID?
        updateProject { tailID = $0.splitCaption(id, afterWords: wordsBefore) }
        guard let tailID else { return }
        setSelectedCaptionIDs([tailID])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Caption split")
        }
    }

    func clearAllCaptions() {
        guard hasCaptions || project.captionsEnabled == true else { return }
        let undoSnapshot = prepareUndoSnapshot()
        updateProject { $0.clearCaptions() }
        setSelectedCaptionIDs([])
        Task {
            await persist()
            recordHistory(before: undoSnapshot)
            setStatus("Captions cleared")
        }
    }
}
