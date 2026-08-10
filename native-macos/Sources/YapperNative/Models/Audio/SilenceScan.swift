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
