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
    /// cut. Corrections are first written back to matching timed transcript
    /// words, and edits that cannot be represented word-for-word are carried
    /// onto the rebuilt card instead of being destroyed.
    mutating func regenerateCaptions(preservingManualEdits: Bool = true) {
        ensureCaptionsMaterialized()
        guard preservingManualEdits else {
            captions = generatedCaptions()
            captionsEnabled = true
            updatedAt = Date()
            return
        }
        let previous = (captions ?? []).filter {
            $0.isTextEdited && !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        var unsynced: [ProjectCaption] = []
        for caption in previous where synchronizeCaptionWithTranscript(caption) == nil {
            unsynced.append(caption)
        }

        var fresh = generatedCaptions()
        var claimed: Set<UUID> = []
        var manual: [ProjectCaption] = []
        for edited in unsynced {
            let matches = fresh.indices.filter { index in
                let candidate = fresh[index]
                return candidate.mediaID == edited.mediaID
                    && candidate.sourceStart < edited.sourceEnd
                    && edited.sourceStart < candidate.sourceEnd
                    && !claimed.contains(candidate.id)
            }
            if let index = matches.max(by: {
                overlap(fresh[$0], edited) < overlap(fresh[$1], edited)
            }) {
                fresh[index].text = edited.text
                fresh[index].isTextEdited = true
                fresh[index].overrides = edited.overrides
                claimed.insert(fresh[index].id)
            } else {
                manual.append(edited)
            }
        }
        captions = fresh + manual
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
        let original = captions![index]
        let originalWords = captionWordIndex(for: captions ?? []).words(for: id)
        captions?[index].text = text
        // The corrected tokens replace the timed words this card came from.
        // That makes the transcript the source of truth, so a later regenerate
        // cannot resurrect the transcriber's old wording.
        let synchronizedWordIDs = synchronizeCaptionWithTranscript(
            captions![index],
            knownWords: original.isTextEdited ? nil : originalWords,
            force: !original.isTextEdited
        )
        captions?[index].isTextEdited = synchronizedWordIDs == nil
        if let synchronizedWordIDs {
            captions?[index].wordIDs = synchronizedWordIDs
        }
        // A deliberate keystroke outranks the shared casing transform, which
        // would otherwise mask the capitalization the creator just typed.
        captions?[index].overrides.textCase = .asSpoken
        updatedAt = Date()
    }

    private mutating func synchronizeCaptionWithTranscript(
        _ caption: ProjectCaption,
        knownWords: [TranscriptWord]? = nil,
        force: Bool = false
    ) -> [UUID]? {
        let tokens = caption.text.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !tokens.isEmpty, var transcript else { return nil }
        let words = knownWords ?? transcript.filter {
            $0.mediaID == caption.mediaID
                && $0.midpoint >= caption.sourceStart
                && $0.midpoint <= caption.sourceEnd
        }.sorted { $0.start < $1.start }
        guard !words.isEmpty else { return nil }
        // Saved projects cannot tell an old hand-added card from an old
        // transcription correction. Only migrate the latter automatically:
        // most of its words still agree with what the transcriber heard. A new
        // edit on a generated card is unambiguous and uses `force`.
        guard force || looksLikeCorrection(tokens, of: words.map(\.text)) else { return nil }

        let replacedIDs = Set(words.map(\.id))
        guard let insertionIndex = transcript.firstIndex(where: { replacedIDs.contains($0.id) }) else {
            return nil
        }
        let timingWords = words.sorted { left, right in
            guard let leftIndex = caption.wordIDs?.firstIndex(of: left.id),
                  let rightIndex = caption.wordIDs?.firstIndex(of: right.id)
            else { return left.start < right.start }
            return leftIndex < rightIndex
        }
        let mappedWordIndexes = tokens.indices.map { tokenIndex in
            guard tokens.count > 1, timingWords.count > 1 else { return 0 }
            if tokens.count >= timingWords.count {
                return Int(ceil(
                    Double(tokenIndex) * Double(timingWords.count - 1)
                        / Double(tokens.count - 1)
                ))
            }
            if tokenIndex == tokens.count - 1 { return timingWords.count - 1 }
            return tokenIndex * timingWords.count / tokens.count
        }
        let replacements = tokens.enumerated().map { offset, token in
            let wordIndex = mappedWordIndexes[offset]
            let timingWord = timingWords[wordIndex]
            let peers = mappedWordIndexes.indices.filter { mappedWordIndexes[$0] == wordIndex }
            let peerIndex = peers.firstIndex(of: offset) ?? 0
            let width = max(0.001, timingWord.end - timingWord.start) / Double(peers.count)
            return TranscriptWord(
                id: peerIndex == 0 ? timingWord.id : UUID(),
                mediaID: timingWord.mediaID,
                text: token,
                start: timingWord.start + Double(peerIndex) * width,
                end: peerIndex == peers.count - 1
                    ? timingWord.end
                    : timingWord.start + Double(peerIndex + 1) * width
            )
        }
        transcript.removeAll { replacedIDs.contains($0.id) }
        transcript.insert(contentsOf: replacements, at: min(insertionIndex, transcript.count))
        self.transcript = transcript
        return replacements.map(\.id)
    }

    private func looksLikeCorrection(_ edited: [String], of spoken: [String]) -> Bool {
        func normalized(_ token: String) -> String {
            token.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
        }
        let editedSet = Set(edited.map(normalized).filter { !$0.isEmpty })
        let spokenSet = Set(spoken.map(normalized).filter { !$0.isEmpty })
        guard !editedSet.isEmpty, !spokenSet.isEmpty else { return false }
        let shared = editedSet.intersection(spokenSet).count
        return Double(shared) / Double(max(editedSet.count, spokenSet.count)) >= 0.5
    }

    private func overlap(_ left: ProjectCaption, _ right: ProjectCaption) -> Double {
        max(0, min(left.sourceEnd, right.sourceEnd) - max(left.sourceStart, right.sourceStart))
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
        let ordered = captionsInTimelineOrder
        guard let orderedIndex = ordered.firstIndex(where: { $0.id == id }) else { return nil }
        let previous = ordered[orderedIndex]
        guard let storageIndex = captions?.firstIndex(where: { $0.id == id }) else { return nil }
        let minimumLength = 0.3
        let defaultLength = 1.4

        let previousTimelineEnd = timelineTime(
            forSource: previous.sourceEnd,
            mediaID: previous.mediaID
        )
        let next = ordered.indices.contains(orderedIndex + 1) ? ordered[orderedIndex + 1] : nil
        let nextTimelineStart = next.map {
            timelineTime(forSource: $0.sourceStart, mediaID: $0.mediaID)
        }
        var timelineStart = previousTimelineEnd + 0.02
        var timelineEnd = timelineStart + defaultLength
        if let nextTimelineStart {
            let room = nextTimelineStart - timelineStart
            if room < minimumLength {
                // No gap to take, so the card ahead lends the room.
                timelineStart = max(0, nextTimelineStart - minimumLength)
                timelineEnd = nextTimelineStart
            } else {
                timelineEnd = min(nextTimelineStart - 0.02, timelineStart + defaultLength)
            }
        }
        guard timelineEnd > timelineStart,
              let head = captionAnchor(atTimelineTime: timelineStart),
              let tail = captionAnchor(atTimelineTime: timelineEnd),
              head.mediaID == tail.mediaID,
              tail.sourceTime > head.sourceTime
        else { return nil }

        // Only trim the previous card when the borrowed room is in that same
        // source clip. Across a reordered cut, changing its source range would
        // corrupt an unrelated stretch of the recording.
        if head.mediaID == previous.mediaID,
           head.sourceTime >= previous.sourceStart,
           head.sourceTime <= previous.sourceEnd {
            captions![storageIndex].sourceEnd = max(
                previous.sourceStart + minimumLength,
                head.sourceTime - 0.02
            )
        }

        let caption = ProjectCaption(
            mediaID: head.mediaID,
            text: "",
            isTextEdited: true,
            sourceStart: head.sourceTime,
            sourceEnd: tail.sourceTime
        )
        captions = (captions ?? []) + [caption]
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
        if !merged.isTextEdited, targets.allSatisfy({ $0.wordIDs != nil }) {
            merged.wordIDs = targets.flatMap { $0.wordIDs ?? [] }
        } else {
            merged.wordIDs = nil
        }
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
        if let wordIDs = caption.wordIDs, wordIDs.count == parts.count {
            head.wordIDs = Array(wordIDs[..<cutIndex])
        }

        var tail = caption
        tail.id = UUID()
        tail.sourceStart = boundary
        tail.text = parts[cutIndex...].joined(separator: " ")
        if let wordIDs = caption.wordIDs, wordIDs.count == parts.count {
            tail.wordIDs = Array(wordIDs[cutIndex...])
        }

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
