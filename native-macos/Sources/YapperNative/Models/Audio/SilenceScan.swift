import Foundation

/// Finding the silence in a recording by listening to it.
///
/// Trimming used to work off the gaps between transcribed words, and a
/// transcriber's word boundaries are generous: it hears a word ending where the
/// sound stops being a word, not where the sound stops. A second of visibly
/// flat waveform routinely reads as a 0.2s gap, which is under any sane
/// threshold, so it survived every pass. This measures the loudness instead, so
/// what gets cut is what is actually quiet.
///
/// Pure, and separate from the decoding, so the rules can be tested against a
/// handful of numbers rather than a file.
enum SilenceScan {
    /// How hard to cut.
    struct Settings: Sendable {
        /// Quiet is relative: a whisper recorded hot and a shout recorded cold
        /// are both speech. The floor is set this far under the recording's own
        /// speech level rather than at a fixed dBFS.
        var dropBelowSpeech: Double = 22
        /// Never treat anything above this as silence, however quiet the take.
        var ceiling: Double = -34
        /// Never treat anything below this as speech, however noisy the room.
        var floor: Double = -60
        /// Shorter than this stays: speech without its small gaps is unlistenable.
        var minimumSilence: Double = 0.18
        /// Left at each edge of a cut, so words keep their attack and release.
        var padding: Double = 0.04
        /// The ends of a take are dead air rather than rhythm, so they go
        /// almost entirely.
        var edgeMinimum: Double = 0.10
        var edgePadding: Double = 0.03
    }

    /// The ranges worth removing, in seconds.
    ///
    /// - Parameters:
    ///   - loudness: RMS per frame, in dBFS, evenly spaced.
    ///   - hop: seconds per frame.
    static func silentRanges(
        loudness: [Double],
        hop: Double,
        settings: Settings = Settings()
    ) -> [(Double, Double)] {
        guard hop > 0, !loudness.isEmpty else { return [] }
        let threshold = self.threshold(loudness: loudness, settings: settings)

        var ranges: [(Double, Double)] = []
        var runStart: Int?
        for (index, level) in loudness.enumerated() {
            if level <= threshold {
                if runStart == nil { runStart = index }
                continue
            }
            if let start = runStart {
                append(&ranges, start: start, end: index, hop: hop, total: loudness.count, settings: settings)
                runStart = nil
            }
        }
        if let start = runStart {
            append(&ranges, start: start, end: loudness.count, hop: hop, total: loudness.count, settings: settings)
        }
        return ranges
    }

    /// The line between speech and silence for this recording.
    ///
    /// Taken from the loud half of the material, because the median of a
    /// recording that is mostly pauses is a pause, and a threshold set from
    /// that would cut nothing at all.
    static func threshold(loudness: [Double], settings: Settings) -> Double {
        let sorted = loudness.sorted()
        guard !sorted.isEmpty else { return settings.ceiling }
        // The 80th percentile stands in for "this is what talking sounds like".
        let speech = sorted[min(sorted.count - 1, Int(Double(sorted.count) * 0.8))]
        let relative = speech - settings.dropBelowSpeech
        return min(settings.ceiling, max(settings.floor, relative))
    }

    /// Silence, kept out of the words.
    ///
    /// A transcriber's word boundaries are generous, so measured quiet often
    /// laps over the start or end of a word that is genuinely spoken. Cutting
    /// there costs the word its attack, and worse, moves its midpoint into the
    /// removed side: the transcript then shows a word struck through that is
    /// still in the video, which is a lie about the edit.
    static func avoiding(
        _ ranges: [(Double, Double)],
        words: [(Double, Double)],
        smallestWorthCutting: Double = 0.05
    ) -> [(Double, Double)] {
        guard !words.isEmpty else { return ranges }
        let spoken = words.sorted { $0.0 < $1.0 }
        var kept: [(Double, Double)] = []

        for range in ranges {
            var pieces = [range]
            for word in spoken where word.1 > range.0 && word.0 < range.1 {
                pieces = pieces.flatMap { piece -> [(Double, Double)] in
                    guard word.1 > piece.0, word.0 < piece.1 else { return [piece] }
                    var remains: [(Double, Double)] = []
                    if word.0 > piece.0 { remains.append((piece.0, word.0)) }
                    if word.1 < piece.1 { remains.append((word.1, piece.1)) }
                    return remains
                }
            }
            // Whatever is left of a cut once the words are out of it can be a
            // few frames wide. Removing those buys nothing and costs a splice.
            kept.append(contentsOf: pieces.filter { $0.1 - $0.0 >= smallestWorthCutting })
        }
        return kept
    }

    /// Closes the slivers between two cuts.
    ///
    /// A breath, a lip smack, a chair creak: loud enough to break a silence in
    /// two, and nothing anybody wants a clip of. Measured on a real take, 14 of
    /// the 34 surviving clips were these, between 0.16s and 0.28s, and not one
    /// of them held a single word.
    ///
    /// Sound is not the test, words are. Anything shorter than `minimumKeep`
    /// with nothing said in it goes with its neighbours, however loud the noise
    /// in it was. Longer than that it stays, because a laugh or a held beat is
    /// wordless too and worth keeping.
    /// - Parameters:
    ///   - lively: loudness per frame and the line above which a wordless
    ///     moment is worth keeping. A laugh reaches it; a breath and a second
    ///     of room tone do not. Without it, length is the only test.
    static func absorbingIslands(
        _ ranges: [(Double, Double)],
        words: [(Double, Double)],
        minimumKeep: Double = 0.6,
        lively: (loudness: [Double], hop: Double, line: Double)? = nil
    ) -> [(Double, Double)] {
        let sorted = ranges.sorted { $0.0 < $1.0 }
        guard sorted.count > 1 else { return sorted }
        var merged: [(Double, Double)] = [sorted[0]]

        for range in sorted.dropFirst() {
            let previous = merged[merged.count - 1]
            let island = (previous.1, range.0)
            let holdsSpeech = words.contains { $0.1 > island.0 && $0.0 < island.1 }
            // Long enough to keep is not the same as worth keeping. Measured on
            // a real take, a 1.22s stretch with nothing said in it sat at
            // -47.9 dB against speech at -27.9: room tone and a breath, which
            // survived on length alone and read as a dead clip on the timeline.
            let isLively = lively.map { hasSound(above: $0.line, in: island, loudness: $0.loudness, hop: $0.hop) } ?? true
            if !holdsSpeech, island.1 - island.0 < minimumKeep || !isLively {
                merged[merged.count - 1] = (previous.0, max(previous.1, range.1))
            } else {
                merged.append(range)
            }
        }
        return merged
    }

    /// The line a wordless moment has to reach to be worth keeping: within
    /// 12 dB of how loud this recording's speech is. A laugh clears it. A
    /// breath, a chair, and a second of room tone do not.
    static func livelyLine(
        for envelope: LoudnessEnvelope.Envelope,
        settings: Settings = Settings()
    ) -> (loudness: [Double], hop: Double, line: Double) {
        let sorted = envelope.loudness.sorted()
        let speech = sorted.isEmpty
            ? settings.ceiling
            : sorted[min(sorted.count - 1, Int(Double(sorted.count) * 0.8))]
        return (envelope.loudness, envelope.hop, speech - 12)
    }

    /// Whether anything in this stretch reaches a given loudness.
    static func hasSound(
        above line: Double,
        in range: (Double, Double),
        loudness: [Double],
        hop: Double
    ) -> Bool {
        guard hop > 0 else { return true }
        let from = max(0, Int(range.0 / hop))
        let to = min(loudness.count, Int(range.1 / hop) + 1)
        guard from < to else { return false }
        return loudness[from ..< to].contains { $0 >= line }
    }

    private static func append(
        _ ranges: inout [(Double, Double)],
        start: Int,
        end: Int,
        hop: Double,
        total: Int,
        settings: Settings
    ) {
        let isEdge = start == 0 || end == total
        let minimum = isEdge ? settings.edgeMinimum : settings.minimumSilence
        let padding = isEdge ? settings.edgePadding : settings.padding
        let from = Double(start) * hop
        let to = Double(end) * hop
        guard to - from >= minimum else { return }

        // A run at the very start or end of the take is padded on one side
        // only: there is nothing outside it to protect.
        let cutFrom = start == 0 ? from : from + padding
        let cutTo = end == total ? to : to - padding
        if cutTo > cutFrom { ranges.append((cutFrom, cutTo)) }
    }
}
