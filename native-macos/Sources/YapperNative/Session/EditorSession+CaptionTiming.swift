import Foundation

/// When each caption shows, edited on the timeline rather than in the list.
///
/// The caption track is where a creator fixes the card that lands a beat late,
/// so everything here works in timeline seconds and leaves the conversion back
/// to recording seconds to `CaptionTimelineEdit`.
@MainActor
extension EditorSession {
    /// Every card as it sits on the timeline right now, from the cache rather
    /// than rebuilt for each reader.
    var captionCues: [ProjectCaptionCue] { captionCueCache.cues }

    func captionCue(_ id: UUID) -> ProjectCaptionCue? { captionCueCache.cue(id) }

    /// What every card says right now, from the cache.
    var captionTexts: [UUID: String] { captionCueCache.textsByID }

    /// The card under the playhead, for the canvas that draws it.
    func captionCue(at timelineTime: Double) -> ProjectCaptionCue? {
        captionCueCache.cue(at: timelineTime)
    }

    func selectCaptionOnTimeline(_ id: UUID) {
        selectTimelineItem(.caption(id))
    }

    /// The end of a drag or a trim on the caption track.
    func retimeCaption(_ id: UUID, timelineStart: Double, end: Double) {
        let undoSnapshot = project
        var moved = false
        updateProject { moved = $0.retimeCaption(id, toTimelineStart: timelineStart, end: end) }
        guard moved else {
            setStatus("A caption cannot be moved onto footage it was not spoken over")
            return
        }
        setSelectedCaptionIDs([id])
        // Cards are drawn by the canvas and burned in at export, so a retime
        // never has to rebuild the composition.
        scheduleVisualCommit(undoSnapshot: undoSnapshot)
    }

    /// Moves a card by a number of seconds, keeping its length. What a group
    /// drag on the timeline does to each selected card.
    @discardableResult
    func nudgeCaption(_ id: UUID, by delta: Double) -> Bool {
        guard let cue = captionCue(id) else { return false }
        let start = CaptionTimelineEdit.clampedStart(
            cue.timelineStart + delta,
            duration: cue.duration,
            projectDuration: duration
        )
        var moved = false
        updateProject { moved = $0.retimeCaption(id, toTimelineStart: start, end: start + cue.duration) }
        return moved
    }

    /// How many of a card's words are already behind the playhead, which is
    /// where a split at the playhead has to cut.
    func captionWordsBeforePlayhead(_ id: UUID) -> Int {
        guard let caption = project.caption(withID: id) else { return 0 }
        guard caption.isTextEdited else {
            let index = project.captionWordIndex(for: project.captionEntries)
            return index.words(for: id).filter { word in
                project.nearestTimelineTime(for: word) < currentTime
            }.count
        }
        // A card placed by hand has no words of its own to count, so where the
        // playhead sits inside it decides where its text is cut.
        guard let cue = captionCue(id), cue.duration > 0 else { return 0 }
        let fraction = min(1, max(0, (currentTime - cue.timelineStart) / cue.duration))
        let words = cue.text.split(whereSeparator: \.isWhitespace).count
        return Int((Double(words) * fraction).rounded())
    }
}
