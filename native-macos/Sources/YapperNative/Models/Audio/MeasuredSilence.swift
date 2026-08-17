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
        let threshold = SilenceScan.threshold(
            loudness: envelope.loudness,
            settings: settings
        )
        let heard = SpokenExtent.audible(
            words: words,
            loudness: envelope.loudness,
            hop: envelope.hop,
            threshold: threshold
        )
        return SilenceScan.absorbingIslands(
            SilenceScan.avoiding(
                SilenceScan.silentRanges(
                    loudness: envelope.loudness,
                    hop: envelope.hop,
                    settings: settings
                ),
                words: heard
            ),
            words: heard,
            lively: SilenceScan.livelyLine(for: envelope, settings: settings)
        )
    }
}
