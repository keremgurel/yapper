import Foundation

extension EditorProject {
    /// Materialises the derived cards of a legacy project so an edit has
    /// something concrete to change. Regeneration is always explicit from here
    /// on, exactly like the web editor.
    private mutating func ensureCaptionsMaterialized() {
        guard captions == nil else { return }
        captions = storedCaptions
    }

    /// Shows or hides the cards. Hiding keeps every one of them — the switch
    /// stops them being drawn and burned in, nothing more — so the text edits
    /// and restyling behind it survive turning captions back on.
    mutating func setCaptionsVisible(_ visible: Bool) {
        guard captionsEnabled != visible else { return }
        ensureCaptionsMaterialized()
        captionsEnabled = visible
        updatedAt = Date()
    }

    /// Replaces every card with a fresh pass over the current transcript and
    /// cut. Per-caption restyling is deliberately dropped: these are new cards.
    mutating func regenerateCaptions() {
        captions = generatedCaptions()
        captionsEnabled = true
        updatedAt = Date()
    }

    /// Captions whatever is now in the cut and has no card over it.
    ///
    /// Restoring a line in the transcript brings back words the cards were
    /// never built over, because they were cut when the cards were made. Those
    /// words get cards here, in place, so the line is captioned the moment it
    /// comes back rather than after a regenerate that would cost the creator
    /// every text edit and restyling in the project.
    mutating func captionRestoredWords() {
        guard captionsEnabled == true else { return }
        let existing = storedCaptions
        guard !existing.isEmpty else { return }
        let added = CaptionGapFill.captions(
            coveringGapsIn: existing,
            words: captionSourceWords,
            wordsPerCard: wordsPerCaptionCard
        )
        guard !added.isEmpty else { return }
        captions = (existing + added).sorted { $0.sourceStart < $1.sourceStart }
        updatedAt = Date()
    }

    mutating func setCaptionWordsPerCard(_ value: Int) {
        let normalized = CaptionWordsPerCard.normalized(value)
        guard normalized != wordsPerCaptionCard else { return }
        let previous = storedCaptions
        captionWordsPerCard = normalized
        // Grouping is a property of the cards themselves, so changing it has to
        // rebuild them. Text edits made on the old grouping cannot survive, but
        // the look does: a card that was recoloured or moved keeps that through
        // a change that is only about where the words break. See
        // `CaptionStyleInheritance`.
        if !previous.isEmpty {
            captions = CaptionStyleInheritance.inherited(generatedCaptions(), from: previous)
        }
        updatedAt = Date()
    }

    mutating func setCaptionText(_ text: String, for id: UUID) {
        ensureCaptionsMaterialized()
        guard let index = captions?.firstIndex(where: { $0.id == id }) else { return }
        guard captions?[index].text != text || captions?[index].isTextEdited == false else { return }
        captions?[index].text = text
        // Typed words are the creator's, so this card stops following the
        // transcript from here on.
        captions?[index].isTextEdited = true
        // A deliberate keystroke outranks the shared casing transform, which
        // would otherwise mask the capitalization the creator just typed.
        captions?[index].overrides.textCase = .asSpoken
        updatedAt = Date()
    }

    /// Moves a card to a stretch of the timeline, which is what dragging or
    /// trimming it on the caption track means. Returns false when that stretch
    /// is not part of the recording the card came from, so nothing moves.
    @discardableResult
    mutating func retimeCaption(
        _ id: UUID,
        toTimelineStart start: Double,
        end: Double
    ) -> Bool {
        ensureCaptionsMaterialized()
        guard
            let index = captions?.firstIndex(where: { $0.id == id }),
            let caption = captions?[index]
        else { return false }
        let text = captionTextsByID[id] ?? caption.text
        guard let retimed = CaptionTimelineEdit.retimed(
            caption,
            text: text,
            toTimelineStart: start,
            end: end,
            in: self
        ) else { return false }
        captions?[index] = retimed
        updatedAt = Date()
        return true
    }

    @discardableResult
    mutating func addCaption(atTimelineTime timelineTime: Double) -> ProjectCaption? {
        ensureCaptionsMaterialized()
        guard let anchor = captionAnchor(atTimelineTime: max(0, timelineTime)) else { return nil }
        let defaultLength = 1.8
        let minimumLength = 0.3
        var end = anchor.sourceTime + defaultLength
        let nextStart = (captions ?? [])
            .filter { $0.mediaID == anchor.mediaID && $0.sourceStart > anchor.sourceTime }
            .map(\.sourceStart)
            .min()
        if let nextStart, nextStart < end {
            end = max(anchor.sourceTime + minimumLength, nextStart - 0.02)
        }
        let caption = ProjectCaption(
            mediaID: anchor.mediaID,
            text: "New caption",
            // A card added by hand is the creator's from the first frame; it
            // must not swap itself for whatever happens to be spoken there.
            isTextEdited: true,
            sourceStart: anchor.sourceTime,
            sourceEnd: end
        )
        captions = ((captions ?? []) + [caption]).sorted { $0.sourceStart < $1.sourceStart }
        captionsEnabled = true
        updatedAt = Date()
        return caption
    }

    /// A new card immediately after `id`, for Return pressed at the end of one.
    ///
    /// It takes the gap between this card and whatever comes next, so writing a
    /// run of cards is Return, type, Return, type, the way a list behaves
    /// everywhere else. When there is no gap it borrows a moment from the end
    /// of the card it follows rather than refusing: a card that cannot be
    /// created because the timing is tight is a dead end with nothing to do
    /// about it.
    mutating func addCaption(after id: UUID) -> ProjectCaption? {
        ensureCaptionsMaterialized()
        guard let index = (captions ?? []).firstIndex(where: { $0.id == id }) else { return nil }
        let previous = captions![index]
        let minimumLength = 0.3
        let defaultLength = 1.4

        let nextStart = (captions ?? [])
            .filter { $0.mediaID == previous.mediaID && $0.sourceStart > previous.sourceEnd }
            .map(\.sourceStart)
            .min()

        var start = previous.sourceEnd + 0.02
        var end = start + defaultLength
        if let nextStart {
            let room = nextStart - start
            if room < minimumLength {
                // No gap to take, so the card ahead lends the room.
                start = max(previous.sourceStart + minimumLength, nextStart - minimumLength)
                captions![index].sourceEnd = max(previous.sourceStart + minimumLength, start - 0.02)
                end = nextStart - 0.02
            } else {
                end = min(nextStart - 0.02, start + defaultLength)
            }
        }
        guard end > start else { return nil }

        let caption = ProjectCaption(
            mediaID: previous.mediaID,
            text: "",
            isTextEdited: true,
            sourceStart: start,
            sourceEnd: end
        )
        captions = ((captions ?? []) + [caption]).sorted { $0.sourceStart < $1.sourceStart }
        captionsEnabled = true
        updatedAt = Date()
        return caption
    }

    mutating func removeCaption(_ id: UUID) {
        ensureCaptionsMaterialized()
        guard captions?.contains(where: { $0.id == id }) == true else { return }
        captions?.removeAll { $0.id == id }
        updatedAt = Date()
    }

    mutating func clearCaptions() {
        guard captionEntries.isEmpty == false || captionsEnabled == true else { return }
        captions = []
        captionsEnabled = false
        updatedAt = Date()
    }

    /// Joins the named cards into one spanning their whole source range, text in
    /// spoken order. Fewer than two real cards is a no-op. The survivor inherits
    /// the earliest card's overrides.
    mutating func mergeCaptions(_ ids: Set<UUID>) {
        ensureCaptionsMaterialized()
        let index = captionWordIndex(for: captions ?? [])
        let targets = (captions ?? [])
            .filter { ids.contains($0.id) }
            .sorted { $0.sourceStart < $1.sourceStart }
        guard targets.count >= 2, let first = targets.first else { return }
        var merged = first
        merged.sourceStart = targets.map(\.sourceStart).min() ?? first.sourceStart
        merged.sourceEnd = targets.map(\.sourceEnd).max() ?? first.sourceEnd
        merged.text = targets
            .map { index.text(for: $0).trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        // The merged range covers every word the parts covered, so a merge of
        // cards that were all still following the transcript keeps following it.
        merged.isTextEdited = targets.contains(where: \.isTextEdited)
        var remaining = (captions ?? []).filter { !ids.contains($0.id) }
        remaining.append(merged)
        captions = remaining.sorted { $0.sourceStart < $1.sourceStart }
        updatedAt = Date()
    }

    /// Cuts a card in two after `wordsBefore` words. A card holding fewer than
    /// two words is left alone rather than spawning an empty ghost.
    ///
    /// A card that is still following the transcript is cut at the silence
    /// between the two words, so both halves keep following it. One that has
    /// been typed into has no words to cut between, so its range is divided in
    /// proportion to the text instead.
    @discardableResult
    mutating func splitCaption(_ id: UUID, afterWords wordsBefore: Int) -> UUID? {
        ensureCaptionsMaterialized()
        let wordIndex = captionWordIndex(for: captions ?? [])
        guard let index = captions?.firstIndex(where: { $0.id == id }), let caption = captions?[index] else {
            return nil
        }
        let parts = wordIndex.text(for: caption).split(whereSeparator: \.isWhitespace).map(String.init)
        guard parts.count >= 2 else { return nil }
        let cutIndex = min(parts.count - 1, max(1, wordsBefore))
        let boundary = splitBoundary(for: caption, at: cutIndex, of: parts.count, words: wordIndex.words(for: caption.id))

        var head = caption
        head.id = UUID()
        head.sourceEnd = boundary
        head.text = parts[..<cutIndex].joined(separator: " ")

        var tail = caption
        tail.id = UUID()
        tail.sourceStart = boundary
        tail.text = parts[cutIndex...].joined(separator: " ")

        captions?.replaceSubrange(index...index, with: [head, tail])
        updatedAt = Date()
        return tail.id
    }

    private func splitBoundary(
        for caption: ProjectCaption,
        at cutIndex: Int,
        of partCount: Int,
        words: [TranscriptWord]
    ) -> Double {
        if !caption.isTextEdited, words.count == partCount, cutIndex < words.count {
            let before = words[cutIndex - 1]
            let after = words[cutIndex]
            return min(caption.sourceEnd, max(caption.sourceStart, (before.end + after.start) / 2))
        }
        let span = caption.sourceEnd - caption.sourceStart
        return caption.sourceStart + (Double(cutIndex) / Double(partCount)) * span
    }

    /// Routes a style change to either the shared style or a selection.
    ///
    /// With apply-to-all on, the change lands on the shared style and every
    /// card drops its override for exactly the fields that changed — a stale
    /// override would keep shadowing the new shared value. With it off the
    /// change is written onto the selected cards only; an empty selection is a
    /// no-op so nothing lands in history.
    mutating func applyCaptionStyle(
        _ patch: TextStylePatch,
        applyToAll: Bool,
        selection: Set<UUID>
    ) {
        guard !patch.isEmpty else { return }
        ensureCaptionsMaterialized()
        if applyToAll {
            var style = captionStyleOrDefault
            style.apply(patch)
            captionStyle = style
            captions = (captions ?? []).map { caption in
                var updated = caption
                updated.clearOverrides(in: patch)
                return updated
            }
        } else {
            guard !selection.isEmpty else { return }
            captions = (captions ?? []).map { caption in
                guard selection.contains(caption.id) else { return caption }
                var updated = caption
                updated.override(with: patch)
                return updated
            }
        }
        updatedAt = Date()
    }
}
