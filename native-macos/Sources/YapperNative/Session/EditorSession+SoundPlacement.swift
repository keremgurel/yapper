import Foundation

/// One sound, already checked against the library and already placed in time.
struct ResolvedSound: Equatable, Sendable {
    let effect: SoundEffectDescriptor
    let timelineStart: Double
}

/// Putting sound effects on the timeline, in batches, from the AI pass.
///
/// `addSoundEffect` drops one effect at the playhead and takes the selection
/// with it, which is what a click on the sound library should do and exactly
/// what a batch of eight should not. These add every sound in one edit and
/// leave the selection where the overlays put it.
@MainActor
extension EditorSession {
    /// Runs a sweep: these sounds, on every one of those, dealt round in turn.
    ///
    /// Answered here rather than by the model, because there is nothing in it
    /// to decide. See `SoundSweep`.
    /// - Parameter instruction: the sentence it came from, so a subset named in
    ///   it is honoured. "Each time I show one of the email overlays" is four
    ///   sounds, not eleven.
    func applySoundSweep(_ sweep: SoundSweep, instruction: String = "") -> [ResolvedSound] {
        let moments: [Double]
        switch sweep.target {
        case .overlays:
            moments = sweptOverlays(instruction: instruction)
                .map(\.timelineStart)
                .sorted()
        case .cuts:
            moments = SoundPlan.cutTimes(clipDurations: project.clips.map(\.duration))
        }
        return moments.enumerated().map { index, start in
            ResolvedSound(effect: sweep.effect(at: index), timelineStart: start)
        }
    }

    /// The cutaways a sweep covers: the ones whose file the sentence named, or
    /// all of them when it named none.
    private func sweptOverlays(instruction: String) -> [ProjectOverlay] {
        let visible = (project.overlays ?? []).filter(\.isVisible)
        let named = MediaNameMatch.mentioned(
            in: instruction,
            names: project.media.map(\.name)
        )
        guard !named.isEmpty else { return visible }
        let wanted = Set(
            project.media.filter { named.contains($0.name) }.map(\.id)
        )
        let subset = visible.filter { wanted.contains($0.mediaID) }
        // A sentence that named files with no cutaways between them is more
        // likely a turn of phrase than a request for nothing at all.
        return subset.isEmpty ? visible : subset
    }

    /// What a sweep found nothing to act on, for the reply that has to say so.
    func sweepEmptyReason(_ sweep: SoundSweep) -> String {
        switch sweep.target {
        case .overlays: "There are no overlays on the timeline to put sounds on."
        case .cuts: "There are no cuts in this edit to put sounds on."
        }
    }

    /// The times the model's standalone sound requests actually land on.
    ///
    /// A request names its moment one of three ways: a time the creator typed
    /// themselves, every cut in the edit, or a stretch of speech. None of them
    /// involves the model counting seconds, which is the one thing it cannot do.
    func resolvedSounds(
        _ requests: [SoundRequest],
        words: [TranscriptWord],
        instruction: String
    ) -> (sounds: [ResolvedSound], unknown: [String]) {
        var sounds: [ResolvedSound] = []
        var unknown: [String] = []

        for request in requests {
            guard let effect = SoundPlan.effect(named: request.effect) else {
                unknown.append(request.effect)
                continue
            }
            let times: [Double]
            if let stated = SoundPlan.statedTime(for: request, in: instruction) {
                // A number the creator wrote down, handed back unchanged.
                times = [stated]
            } else if let every = SoundPlan.every(request) {
                // Several effects asked for as a mixture are dealt round rather
                // than all landing on every moment, which would be three sounds
                // on one frame and reads as a mistake.
                let moments = self.moments(for: every)
                let siblings = requests.filter { SoundPlan.every($0) == every }
                let turn = siblings.firstIndex { $0 == request } ?? 0
                times = moments.enumerated()
                    .filter { index, _ in index % max(1, siblings.count) == turn }
                    .map(\.element)
            } else if let time = spokenTime(quote: request.quote, cue: request.cue, words: words) {
                // A sound lands on the beat rather than ahead of it. The lead-in
                // an overlay gets is there because the eye is slow; the ear is
                // not, and a pop before the word is a pop in the wrong place.
                times = [time]
            } else {
                times = []
            }
            sounds.append(contentsOf: times.map { ResolvedSound(effect: effect, timelineStart: $0) })
        }
        return (sounds, unknown)
    }

    /// The moments an `every` covers, in order.
    private func moments(for every: SoundPlan.Every) -> [Double] {
        switch every {
        case .cut:
            SoundPlan.cutTimes(clipDurations: project.clips.map(\.duration))
        case .overlay:
            (project.overlays ?? []).filter(\.isVisible).map(\.timelineStart).sorted()
        }
    }

    /// Adds every sound to the timeline. Call inside an edit that is already
    /// snapshotted for undo; this only changes the project.
    func addSounds(_ sounds: [ResolvedSound]) {
        guard !sounds.isEmpty, duration > 0 else { return }
        var layers = project.audioLayers ?? []
        // Two effects on the same frame is one effect played twice, which reads
        // as a mistake rather than an accent.
        var taken: [Double] = layers.map(\.timelineStart)

        for sound in sounds {
            guard let url = soundEffectService.bundledURL(for: sound.effect) else { continue }
            let start = min(max(0, sound.timelineStart), max(0, duration - 0.02))
            guard !taken.contains(where: { abs($0 - start) < SoundPlan.minimumGap }) else { continue }
            taken.append(start)
            layers.append(
                ProjectAudioLayer(
                    url: url,
                    name: sound.effect.name,
                    timelineStart: start,
                    duration: min(sound.effect.duration, max(0.02, duration - start)),
                    sourceDuration: sound.effect.duration,
                    builtInID: sound.effect.id,
                    sourceKind: .builtIn
                )
            )
        }
        updateProject { project in
            project.audioLayers = layers
        }
    }

    /// When a quoted phrase is heard, at the word the cue points at.
    private func spokenTime(quote: String?, cue: String?, words: [TranscriptWord]) -> Double? {
        guard
            let quote, !quote.trimmingCharacters(in: .whitespaces).isEmpty,
            let span = OverlayPlan.quoteSpan(in: words, quote: quote),
            words.indices.contains(span.lowerBound)
        else { return nil }
        let anchor = cue.flatMap { OverlayCue.anchor(in: words, span: span, cue: $0) }
            ?? span.lowerBound
        guard words.indices.contains(anchor) else { return nil }
        return project.nearestTimelineTime(for: words[anchor])
    }
}
