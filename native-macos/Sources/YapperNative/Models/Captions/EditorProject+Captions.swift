import Foundation

/// One caption card resolved onto the edited timeline, ready to draw or burn in.
struct ProjectCaptionCue: Equatable, Identifiable, Sendable {
    var id: UUID
    var text: String
    var timelineStart: Double
    var timelineEnd: Double
    var style: TextStyle

    var duration: Double { max(0, timelineEnd - timelineStart) }

    /// The text as it should appear, with the display-only casing applied.
    var displayText: String { style.appearance.displayText(text) }

    func isVisible(at time: Double) -> Bool {
        time >= timelineStart && time < timelineEnd
    }
}

extension EditorProject {
    var captionStyleOrDefault: TextStyle {
        captionStyle ?? .default
    }

    var wordsPerCaptionCard: Int {
        CaptionWordsPerCard.normalized(captionWordsPerCard)
    }

    /// Every card the project holds, whether or not captions are currently
    /// showing. Hiding captions is a visibility switch, not a delete: the cards
    /// stay here so the creator's text edits and restyling survive it.
    ///
    /// Projects saved before captions became editable stored no cards at all,
    /// only the switch, so theirs are derived on the way out.
    var storedCaptions: [ProjectCaption] {
        if let captions { return captions }
        return captionsEnabled == true ? generatedCaptions() : []
    }

    /// The cards that should actually be drawn and burned in.
    var captionEntries: [ProjectCaption] {
        captionsEnabled == true ? storedCaptions : []
    }

    /// Cards regenerated from the current transcript and cut.
    func generatedCaptions() -> [ProjectCaption] {
        CaptionGenerator.captions(from: captionSourceWords, wordsPerCard: wordsPerCaptionCard)
    }

    /// Kept words in timeline order, which is the only order captions can be
    /// grouped in once clips have been reordered.
    var captionSourceWords: [CaptionSourceWord] {
        timelineTranscript.compactMap { word -> CaptionSourceWord? in
            guard isWordKept(word), let start = timelineTime(for: word) else { return nil }
            let clip = clips.first {
                $0.mediaID == word.mediaID
                    && word.midpoint >= $0.sourceStart
                    && word.midpoint <= $0.sourceEnd
            }
            let text = word.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            return CaptionSourceWord(
                mediaID: word.mediaID,
                text: text,
                sourceStart: word.start,
                sourceEnd: word.end,
                timelineStart: start,
                timelineEnd: min(duration, start + max(0.12, word.end - word.start)),
                clip: clip.map { $0.sourceStart ... $0.sourceEnd }
            )
        }
        .sorted { left, right in
            if abs(left.timelineStart - right.timelineStart) > 0.000_1 {
                return left.timelineStart < right.timelineStart
            }
            return left.timelineEnd < right.timelineEnd
        }
    }

    /// Which words each card is currently covering, so cutting a word takes it
    /// off its card and restoring it puts it back.
    ///
    /// Takes the cards rather than reading them back, because a project saved
    /// before captions were editable mints a fresh set every time it is asked —
    /// an index built from one call would know nothing about the cards in the
    /// next.
    func captionWordIndex(for captions: [ProjectCaption]) -> CaptionWordIndex {
        CaptionWordIndex(
            captions: captions,
            keptWords: timelineTranscript.filter(isWordKept)
        )
    }

    /// What every card says right now, keyed by card. One pass, for panels that
    /// would otherwise ask card by card.
    var captionTextsByID: [UUID: String] {
        let captions = storedCaptions
        let index = captionWordIndex(for: captions)
        return captions.reduce(into: [:]) { result, caption in
            result[caption.id] = index.text(for: caption)
        }
    }

    /// Cards placed on the edited timeline. Cut cards drop out, trimmed cards
    /// follow their words, and no two cards are ever on screen at once.
    var captionCues: [ProjectCaptionCue] {
        let base = captionStyleOrDefault
        let entries = captionEntries
        let index = captionWordIndex(for: entries)
        var cues: [ProjectCaptionCue] = entries.compactMap { caption in
            let text = index.text(for: caption)
            guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            guard let range = index.sourceRange(for: caption) else { return nil }
            // A card that still follows the transcript goes when its words go.
            // A card placed by hand was put there on purpose, so it stays even
            // when the stretch it spans has a cut through the middle of it; if
            // the whole span has been cut away it collapses to nothing and is
            // dropped by the check below.
            guard caption.isTextEdited || isSourceRangeKept(
                mediaID: caption.mediaID,
                start: range.start,
                end: range.end
            ) else { return nil }
            let start = timelineTime(forSource: range.start, mediaID: caption.mediaID)
            let end = timelineTime(forSource: range.end, mediaID: caption.mediaID)
            guard end > start else { return nil }
            return ProjectCaptionCue(
                id: caption.id,
                text: text,
                timelineStart: max(0, start),
                timelineEnd: min(duration, end),
                style: caption.resolvedStyle(base: base)
            )
        }
        .sorted { $0.timelineStart < $1.timelineStart }

        for index in cues.indices.dropLast() {
            cues[index].timelineEnd = min(
                cues[index].timelineEnd,
                max(cues[index].timelineStart + 0.12, cues[index + 1].timelineStart)
            )
        }
        return cues
    }

    func captionCue(at timelineTime: Double) -> ProjectCaptionCue? {
        captionCues.first { $0.isVisible(at: timelineTime) }
    }

    func caption(withID id: UUID) -> ProjectCaption? {
        captionEntries.first { $0.id == id }
    }

    /// Where a recording second lands on the edited timeline. A cut second has
    /// no position of its own, so it snaps to the near edge of the closest
    /// surviving clip and the caption anchored there stays reachable.
    func timelineTime(forSource sourceTime: Double, mediaID: UUID) -> Double {
        var cursor = 0.0
        var nearest: (gap: Double, timeline: Double)?
        for clip in clips {
            let clipDuration = clip.duration
            if clip.mediaID == mediaID {
                if sourceTime >= clip.sourceStart, sourceTime <= clip.sourceEnd {
                    return cursor + (sourceTime - clip.sourceStart)
                }
                let isBefore = sourceTime < clip.sourceStart
                let gap = isBefore ? clip.sourceStart - sourceTime : sourceTime - clip.sourceEnd
                if nearest == nil || gap < nearest!.gap {
                    nearest = (gap, isBefore ? cursor : cursor + clipDuration)
                }
            }
            cursor += clipDuration
        }
        return nearest?.timeline ?? 0
    }

    /// The recording second playing at a timeline position, for the media under
    /// the playhead. Used when a new caption is added where the creator is.
    func captionAnchor(atTimelineTime timelineTime: Double) -> (mediaID: UUID, sourceTime: Double)? {
        var cursor = 0.0
        for clip in clips {
            let clipDuration = clip.duration
            if timelineTime >= cursor, timelineTime <= cursor + clipDuration {
                return (clip.mediaID, clip.sourceStart + (timelineTime - cursor))
            }
            cursor += clipDuration
        }
        guard let last = clips.last else { return nil }
        return (last.mediaID, last.sourceEnd)
    }
}
