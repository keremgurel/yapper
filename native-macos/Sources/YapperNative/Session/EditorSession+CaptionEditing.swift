import Foundation

/// Caption content: what the cards say, how many there are, and where they
/// start and end.
extension EditorSession {
    /// A keystroke in a caption row: drawn on the canvas at once, saved when
    /// editing ends (`commitCaptionText`), so a sentence is one Undo step.
    func setCaptionText(_ text: String, for id: UUID) {
        guard project.caption(withID: id) != nil else { return }
        typingPreview.typeCaption(id, text)
    }

    /// Saves what was typed into a caption through the text action Chirpy
    /// uses. Emptied, the card goes, the way it always has. The draft stays
    /// on screen until the edit lands, so the card never shows the old text.
    @discardableResult
    func commitCaptionText(for id: UUID) async -> AppActionResult? {
        guard let typed = typingPreview.captionText[id] else { return nil }
        defer { typingPreview.releaseCaption(id, ifStill: typed) }
        guard let saved = project.caption(withID: id)?.text else { return nil }
        if typed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return await performAppAction(CaptionRemoveInput(captionIDs: [id]))
        }
        guard typed != saved else { return nil }
        return await performAppAction(CaptionTextInput(captionID: id, text: String(typed.prefix(300))))
    }

    /// Saves every caption and text layer still being typed into. Edits that
    /// restructure a card (split, merge, a new one after it) run this first,
    /// so what was typed lands before the card changes shape.
    func commitTyping() async {
        for id in typingPreview.captionText.keys.sorted(by: { $0.uuidString < $1.uuidString }) { await commitCaptionText(for: id) }
        for id in typingPreview.textLayerText.keys.sorted(by: { $0.uuidString < $1.uuidString }) { await commitTextLayerText(for: id) }
    }

    func addCaptionAtPlayhead() async {
        guard !project.clips.isEmpty else { return }
        await performAppAction(CaptionAddInput(at: .playhead, afterCaptionID: nil, text: nil))
    }

    /// Return at the end of a card: a new one after it, selected, ready to type
    /// into. What Return does everywhere else a list of lines is edited.
    @discardableResult
    func addCaption(after id: UUID) async -> UUID? {
        await commitTyping()
        let result = await performAppAction(CaptionAddInput(at: nil, afterCaptionID: id, text: nil))
        return result.status == .applied ? result.changes.first?.targetID : nil
    }

    func removeCaption(_ id: UUID) async {
        await commitTyping()
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
        await commitTyping()
        let ordered = captions
        guard let index = ordered.firstIndex(where: { $0.id == id }), index > 0 else { return nil }
        let previous = ordered[index - 1]
        let result = await performAppAction(CaptionMergeInput(captionIDs: [previous.id, id]))
        guard result.status == .applied else { return nil }
        return result.changes.first.flatMap { UUID(uuidString: $0.after) } ?? previous.id
    }

    /// Enter in a caption row cuts it at the cursor's word boundary, through
    /// the split action Chirpy uses. Returns the new card, which the action
    /// selects.
    func splitCaption(_ id: UUID, afterWords wordsBefore: Int) async -> UUID? {
        guard wordsBefore >= 1 else { return nil }
        await commitTyping()
        let result = await performAppAction(CaptionSplitInput(captionID: id, afterWords: min(300, wordsBefore)))
        guard result.status == .applied else { return nil }
        return result.changes.first.flatMap { UUID(uuidString: $0.after) }
    }

    func clearAllCaptions() async {
        guard hasCaptions || project.captionsEnabled == true else { return }
        let result = await performAppAction(ClearTrackInput(track: .captions))
        if result.status == .applied { setSelectedCaptionIDs([]) }
    }
}
