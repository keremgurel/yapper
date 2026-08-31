import Foundation

/// The quiet worth removing from a take, measured from the recording.
///
/// One place that knows the order of the passes, because both the one-click
/// edit and Auto-trim want the same answer and drifting apart would mean the
/// two buttons disagreed about what silence is.
enum MeasuredSilence {
    /// - Parameter words: what the transcriber heard, in source seconds. Each
    ///   one is narrowed to the part that actually sounds before it is used to
    ///   protect anything, so a pause reported as the tail of a word is still
    ///   a pause.
    static func ranges(
        envelope: LoudnessEnvelope.Envelope,
        words: [(Double, Double)],
        settings: SilenceScan.Settings = SilenceScan.Settings()
    ) -> [(Double, Double)] {
        guard !envelope.loudness.isEmpty else { return [] }
        // The broad silence line admits soft consonants, but it also admits
        // low room-noise spikes long after a word's real release. Use the
        // stronger "worth hearing" line to find the word's audible extent;
        // its playback anchor still protects every word when the signal is
        // unusually soft.
        let lively = SilenceScan.livelyLine(for: envelope, settings: settings)
        let heard = SpokenExtent.audible(
            words: words,
            loudness: envelope.loudness,
            hop: envelope.hop,
            threshold: lively.line
        )
        // Keep frame-sized quiet runs until after noise-island absorption. If
        // the minimum is enforced first, 40 ms of quiet, a 20 ms room-noise
        // spike, then three seconds of silence becomes only the latter range
        // and leaves the flat lead-in on the clip.
        var scanSettings = settings
        scanSettings.minimumSilence = min(settings.minimumSilence, max(0.02, envelope.hop))
        return SilenceScan.absorbingIslands(
            SilenceScan.avoiding(
                SilenceScan.silentRanges(
                    loudness: envelope.loudness,
                    hop: envelope.hop,
                    settings: scanSettings
                ),
                words: heard,
                // Preserve frame-sized cuts until the island pass has had a
                // chance to join them. Dropping them here can strand a 20 ms
                // noise spike between two otherwise continuous silent ranges.
                smallestWorthCutting: 0
            ),
            words: heard,
            lively: lively
        ).filter { $0.1 - $0.0 >= settings.minimumSilence }
    }
}
