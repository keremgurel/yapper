import Foundation

/// Turning spans of speech into words drawn over the video.
///
/// The text half of the placement pass. By the time anything gets here every
/// quote has been matched against real words, so the only questions left are
/// when each label arrives, how long it holds, and where it sits when several
/// of them are up at once.
@MainActor
extension EditorSession {
    /// One piece of text, resolved onto the timeline.
    private struct TimedText {
        let span: PlacedTextSpan
        /// When it comes on, a beat before its anchor word.
        let start: Double
        /// When it leaves, before the holds are worked out.
        let end: Double
    }

    /// Places every piece of text the pass asked for, and says what it did.
    func applyPlacedTexts(
        _ spans: [PlacedTextSpan],
        words: [TranscriptWord]
    ) -> [String] {
        let timed = spans.compactMap { resolve($0, words: words) }
        guard !timed.isEmpty else { return [] }

        let ends = holdEnds(for: timed, words: words)
        let rows = TextStackLayout.rows(
            for: zip(timed, ends).map { .init(start: $0.start, end: $1) }
        )

        var placed: [ProjectTextLayer] = []
        var notes: [String] = []
        for (index, unit) in timed.enumerated() {
            let end = ends[index]
            let duration = min(
                max(OverlayPlan.minimumSpanSeconds, end - unit.start),
                max(0.1, duration - unit.start)
            )
            guard duration >= OverlayPlan.minimumSpanSeconds else { continue }
            placed.append(
                ProjectTextLayer(
                    text: unit.span.text,
                    timelineStart: unit.start,
                    duration: duration,
                    y: rows[index],
                    // Narrower than a hook, because these are labels rather
                    // than headlines and several of them share the screen.
                    width: 0.62,
                    appearance: .textLayerDefault
                )
            )
            notes.append("“\(unit.span.text)” · \(formatTime(unit.start)) · \(heldFor(unit, until: end))")
        }

        guard !placed.isEmpty else { return [] }
        updateProject { project in
            project.textLayers = (project.textLayers ?? []) + placed
        }
        if let last = placed.last { selectTimelineItem(.text(last.id)) }
        return notes
    }

    /// A span with its seconds worked out. The text comes on for its anchor
    /// word and, left to itself, leaves at the end of the sentence it was
    /// quoted from.
    private func resolve(_ span: PlacedTextSpan, words: [TranscriptWord]) -> TimedText? {
        guard
            words.indices.contains(span.anchorWord),
            words.indices.contains(span.lastWord)
        else { return nil }
        let last = words[span.lastWord]
        let start = OverlayCue.start(
            forWordAt: project.nearestTimelineTime(for: words[span.anchorWord])
        )
        let end = project.nearestTimelineTime(for: last) + max(0.08, last.end - last.start)
        guard end > start else { return nil }
        return TimedText(span: span, start: start, end: end)
    }

    /// When each piece of text leaves, once its hold has been honoured.
    ///
    /// Worked out for the batch rather than one at a time, because "until the
    /// next one" is a question about its neighbours.
    private func holdEnds(for timed: [TimedText], words: [TranscriptWord]) -> [Double] {
        timed.enumerated().map { index, unit in
            switch unit.span.hold {
            case .quote:
                return unit.end
            case .end:
                return duration
            case .next:
                // The next one on screen, or the end of the video for the last
                // of them: there is nothing after it to make way for.
                guard index + 1 < timed.count else { return duration }
                return max(unit.end, timed[index + 1].start)
            case .untilQuote:
                guard
                    let holdWord = unit.span.holdUntilWord,
                    words.indices.contains(holdWord)
                else { return unit.end }
                let word = words[holdWord]
                let held = project.nearestTimelineTime(for: word)
                    + max(0.08, word.end - word.start)
                // Never shorter than its own sentence: a hold is a request for
                // more time, and words the speaker had already finished saying
                // would take it away.
                return max(unit.end, held)
            }
        }
    }

    private func heldFor(_ unit: TimedText, until end: Double) -> String {
        switch unit.span.hold {
        case .quote: "over “\(unit.span.text.isEmpty ? "" : unit.span.text)”"
        case .next: "held until the next"
        case .end: "held to the end"
        case .untilQuote: "held to \(formatTime(end))"
        }
    }
}
