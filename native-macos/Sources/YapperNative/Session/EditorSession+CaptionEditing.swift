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
        let insertionTime = currentTime
        var created: ProjectCaption?
        await commitTimelineEdit(requiresRebuild: false, successStatus: "Caption added") { [self] in
            updateProject { created = $0.addCaption(atTimelineTime: insertionTime) }
            guard let created else { return false }
            setSelectedCaptionIDs([created.id])
            return true
        }
    }

    /// Return at the end of a card: a new one after it, selected, ready to type
    /// into. What Return does everywhere else a list of lines is edited.
    @discardableResult
    func addCaption(after id: UUID) async -> UUID? {
        var created: ProjectCaption?
        let success = await commitTimelineEdit(requiresRebuild: false) { [self] in
            updateProject { created = $0.addCaption(after: id) }
            guard let created else { return false }
            setSelectedCaptionIDs([created.id])
            return true
        }
        return success ? created?.id : nil
    }

    func removeCaption(_ id: UUID) async {
        guard project.caption(withID: id) != nil else { return }
        await commitTimelineEdit(requiresRebuild: false, successStatus: "Caption deleted") { [self] in
            guard project.caption(withID: id) != nil else { return false }
            updateProject { $0.removeCaption(id) }
            var ids = selectedCaptionIDs
            ids.remove(id)
            setSelectedCaptionIDs(ids)
            return true
        }
    }

    var canMergeSelectedCaptions: Bool { selectedCaptionIDs.count >= 2 }

    func mergeSelectedCaptions() async {
        guard canMergeSelectedCaptions else { return }
        let merging = selectedCaptionIDs
        await commitTimelineEdit(
            requiresRebuild: false,
            successStatus: "Merged \(merging.count) captions"
        ) { [self] in
            updateProject { $0.mergeCaptions(merging) }
            setSelectedCaptionIDs([])
            return true
        }
    }

    /// Backspace at the very start of a caption row folds it into the row
    /// above, the mirror of Return splitting one in two. Returns the surviving
    /// caption so the caller can keep editing where the text landed.
    @discardableResult
    func mergeCaptionIntoPrevious(_ id: UUID) async -> UUID? {
        var survivor: UUID?
        let success = await commitTimelineEdit(
            requiresRebuild: false,
            successStatus: "Captions merged"
        ) { [self] in
            let ordered = captions
            guard let index = ordered.firstIndex(where: { $0.id == id }), index > 0 else { return false }
            let previous = ordered[index - 1]
            updateProject { $0.mergeCaptions([previous.id, id]) }
            survivor = captions.first { $0.sourceStart == previous.sourceStart }?.id ?? previous.id
            setSelectedCaptionIDs(Set([survivor].compactMap { $0 }))
            return true
        }
        return success ? survivor : nil
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
