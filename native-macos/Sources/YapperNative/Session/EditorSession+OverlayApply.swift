import CoreGraphics
import Foundation

/// Everything the placement pass changed, in one answer.
struct PlacedOverlayBatch: Sendable {
    /// One line per overlay, in the creator's own terms.
    let notes: [String]
    /// The effects that ride along with those overlays.
    let sounds: [ResolvedSound]
    var skippedExisting = 0

    static let empty = PlacedOverlayBatch(notes: [], sounds: [])
}

/// Turning spans of speech into overlays on the timeline.
///
/// The half of the placement pass that has stopped talking to a model. By the
/// time anything gets here every quote has been matched against real words, so
/// the only questions left are when each overlay comes on, where it sits, and
/// which ones belong to each other.
@MainActor
extension EditorSession {
    /// One placement, resolved onto the timeline.
    private struct TimedSpan {
        let span: PlacedOverlaySpan
        let media: ProjectMedia
        /// When it comes on screen, a beat before its cue word.
        let start: Double
        /// When it leaves, before a row makes them all leave together.
        let end: Double
    }

    func applyPlacedSpans(
        _ spans: [PlacedOverlaySpan],
        words: [TranscriptWord],
        files: [ProjectMedia]
    ) async -> PlacedOverlayBatch {
        // The model is told about existing placements, but can still return
        // them again. Filter before grouping so rejected copies neither shrink
        // a row nor add a second sound. A reveal and its original are one asset.
        var timed: [TimedSpan] = []
        var skippedExisting = 0
        func sourceID(_ media: ProjectMedia) -> UUID { media.generated?.revealSourceMediaID ?? media.id }
        for span in spans {
            guard let candidate = resolve(span, words: words, files: files) else { continue }
            let source = sourceID(candidate.media)
            let alreadyPlaced = (project.overlays ?? []).contains { overlay in
                guard let media = project.media.first(where: { $0.id == overlay.mediaID }) else { return false }
                return sourceID(media) == source && overlay.timelineStart < candidate.end &&
                    overlay.timelineStart + overlay.duration > candidate.start
            }
            let repeatedInReply = timed.contains {
                sourceID($0.media) == source && $0.start < candidate.end && $0.end > candidate.start
            }
            if alreadyPlaced || repeatedInReply { skippedExisting += 1 }
            else { timed.append(candidate) }
        }
        guard !timed.isEmpty else {
            return PlacedOverlayBatch(notes: [], sounds: [], skippedExisting: skippedExisting)
        }

        var placed: [ProjectOverlay] = []
        var notes: [String] = []
        var sounds: [ResolvedSound] = []

        for unit in units(of: timed) {
            guard !Task.isCancelled else { return .empty }
            // Each unit has to see the ones before it, or a whole batch would
            // pile onto the same lane and onto the same corner.
            let alongside = (project.overlays ?? []) + placed
            let boxes = unit.count > 1
                ? await rowBoxes(unit, alongside: alongside)
                : [await singleBox(unit[0], alongside: alongside)]
            guard boxes.count == unit.count else { continue }

            // A row leaves together. That is what makes it build up as each
            // icon arrives rather than flicker one out as the next comes in.
            let end = unit.map(\.end).max() ?? 0

            for (member, box) in zip(unit, boxes) {
                let duration = min(
                    max(OverlayPlan.minimumSpanSeconds, end - member.start),
                    max(0.1, project.duration - member.start)
                )
                guard duration >= OverlayPlan.minimumSpanSeconds else { continue }
                // Grouping can extend a member beyond its original quote.
                // Recheck the final interval against earlier members as well.
                let clashes = ((project.overlays ?? []) + placed).contains { overlay in
                    guard let media = project.media.first(where: { $0.id == overlay.mediaID }) else { return false }
                    return sourceID(media) == sourceID(member.media) &&
                        overlay.timelineStart < member.start + duration &&
                        overlay.timelineStart + overlay.duration > member.start
                }
                if clashes { skippedExisting += 1; continue }
                placed.append(
                    introducedOverlay(
                        media: member.media,
                        timelineStart: member.start,
                        duration: duration,
                        alongside: (project.overlays ?? []) + placed,
                        box: box
                    )
                )
                notes.append(note(for: member, box: box, words: words))
                if let effect = member.span.sound.flatMap(SoundPlan.effect(named:)) {
                    sounds.append(
                        ResolvedSound(effect: effect, timelineStart: member.start)
                    )
                }
            }
        }

        guard !Task.isCancelled else { return .empty }
        guard !placed.isEmpty else {
            return PlacedOverlayBatch(notes: [], sounds: [], skippedExisting: skippedExisting)
        }
        updateProject { project in
            project.overlays = (project.overlays ?? []) + placed
        }
        if let last = placed.last { selectTimelineItem(.overlay(last.id)) }
        return PlacedOverlayBatch(notes: notes, sounds: sounds, skippedExisting: skippedExisting)
    }

    /// A span with its seconds worked out.
    ///
    /// The overlay comes on for its anchor word, which is the cue when the model
    /// named one and the start of the quote when it did not, and leaves at the
    /// end of the sentence that was quoted.
    private func resolve(
        _ span: PlacedOverlaySpan,
        words: [TranscriptWord],
        files: [ProjectMedia]
    ) -> TimedSpan? {
        guard
            let media = files.first(where: { $0.name == span.file }),
            words.indices.contains(span.anchorWord),
            words.indices.contains(span.lastWord)
        else { return nil }
        let last = words[span.lastWord]
        let start = OverlayCue.start(
            forWordAt: project.nearestTimelineTime(for: words[span.anchorWord])
        )
        let end = (project.timelineEnd(for: last) ?? project.nearestTimelineTime(for: last))
        guard end > start else { return nil }
        return TimedSpan(span: span, media: media, start: start, end: end)
    }

    /// The batch split into things that are laid out together.
    ///
    /// A group is one unit however many icons are in it; everything else is a
    /// unit of one. Units come in the order they are first seen, and the members
    /// of a row in the order they are spoken, which is what puts Instagram to
    /// the left of TikTok when that is the order they were named.
    ///
    /// Icons cued off the same word all appear at once, and then there is no
    /// spoken order to sort on. Those fall back to the order the model listed
    /// them, which follows the order they were asked for. Sorting on time alone
    /// would leave it to whatever the sort happened to do that day.
    private func units(of timed: [TimedSpan]) -> [[TimedSpan]] {
        var units: [[TimedSpan]] = []
        var groups: [String: Int] = [:]
        let ordered = timed.enumerated()
            .sorted { ($0.element.start, $0.offset) < ($1.element.start, $1.offset) }
            .map(\.element)
        for span in ordered {
            guard let group = span.span.group, !group.isEmpty else {
                units.append([span])
                continue
            }
            if let index = groups[group] {
                units[index].append(span)
            } else {
                groups[group] = units.count
                units.append([span])
            }
        }
        return units
    }

    private func singleBox(_ member: TimedSpan, alongside: [ProjectOverlay]) async -> OverlayBox {
        await OverlayLayout.solve(
            proposed: member.span.box,
            mediaAspect: CompositionBuilder.aspect(of: member.media),
            frameAspect: project.resolvedAspectRatio,
            avoid: avoidRegions(from: member.start, to: member.end, alongside: alongside)
        )
    }

    /// One box per member of a row: all the same height, on the same baseline,
    /// side by side in the order they are spoken.
    private func rowBoxes(_ unit: [TimedSpan], alongside: [ProjectOverlay]) async -> [OverlayBox] {
        // A row is on screen from its first icon to its last one leaving, so
        // what it has to clear is the speaker across all of that.
        let start = unit.map(\.start).min() ?? 0
        let end = unit.map(\.end).max() ?? 0
        // The model proposes one row, not one box per icon, so the first thing
        // it did say is the row's.
        let proposed = unit.compactMap(\.span.box).first
        return OverlayRowLayout.solve(
            members: unit.map {
                .init(mediaAspect: CompositionBuilder.aspect(of: $0.media))
            },
            proposedWidth: proposed?.width,
            proposedOrigin: proposed.map { (x: $0.x, y: $0.y) },
            frameAspect: project.resolvedAspectRatio,
            avoid: await avoidRegions(from: start, to: end, alongside: alongside)
        )
    }

    private func avoidRegions(
        from start: Double,
        to end: Double,
        alongside: [ProjectOverlay]
    ) async -> [SpeakerRegion] {
        await speakerRegions(from: start, to: end)
            + neighbourRegions(from: start, to: end, among: alongside)
    }

    /// The overlays already sharing this stretch of the timeline, as places a
    /// new one would rather not land.
    ///
    /// Weighted below the speaker: two cards touching is untidy, and a card on
    /// a face is wrong.
    private func neighbourRegions(
        from start: Double,
        to end: Double,
        among existing: [ProjectOverlay]
    ) -> [SpeakerRegion] {
        existing
            .filter { $0.isVisible && $0.timelineStart < end && $0.timelineStart + $0.duration > start }
            .map {
                SpeakerRegion(
                    rect: CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height),
                    weight: SpeakerRegions.neighbourWeight
                )
            }
    }

    /// What the panel says this placement did.
    ///
    /// A cued overlay is described by its cue word, not by the sentence it was
    /// found in: "over Instagram" is the thing being checked, and the whole
    /// sentence around it is noise on a line that has to be scannable.
    private func note(for member: TimedSpan, box: OverlayBox, words: [TranscriptWord]) -> String {
        let span = member.span
        let quote: String
        if span.anchorWord != span.firstWord {
            quote = words[span.anchorWord].text
        } else {
            let range = span.firstWord ... max(span.firstWord, span.lastWord)
            quote = words[range].map(\.text).joined(separator: " ")
        }
        let sound = span.sound.flatMap(SoundPlan.effect(named:)).map { " · \($0.name)" } ?? ""
        return "\(member.media.name) · \(formatTime(member.start)) · "
            + "\(OverlayLayout.describe(box))\(sound) over “\(quote)”"
    }
}
