import Foundation
import Testing
@testable import YapperNative

/// How much of a word the trimmer has to leave alone.
///
/// The transcriber reports the last word of a phrase as running until the
/// speaker starts again. Believing that timing is why a visibly flat second of
/// waveform survived every pass and reached the finished cut.
@Suite
struct SpokenExtentTests {
    private let hop = 0.02
    private let threshold = -40.0

    /// Loud for `soundSeconds`, then room tone until `total`.
    private func envelope(soundSeconds: Double, total: Double) -> [Double] {
        let frames = Int(total / hop)
        return (0 ..< frames).map { Double($0) * hop < soundSeconds ? -20 : -60 }
    }

    @Test("A word that stops sounding early stops protecting early")
    func trimsTheSilentTail() {
        let loudness = envelope(soundSeconds: 0.80, total: 1.20)
        let audible = SpokenExtent.audible(
            word: (0, 1.2),
            loudness: loudness,
            hop: hop,
            threshold: threshold
        )
        #expect(audible.0 == 0)
        // The sound ends at 0.80, plus the padding that keeps the release.
        #expect(abs(audible.1 - 0.86) < 0.03)
        // Which is 0.34s of the transcriber's word that is free to cut.
        #expect(1.2 - audible.1 > 0.3)
    }

    @Test("The midpoint is protected even when the sound stops before it")
    func keepsTheMidpoint() {
        let loudness = envelope(soundSeconds: 0.10, total: 1.00)
        let audible = SpokenExtent.audible(
            word: (0, 1.0),
            loudness: loudness,
            hop: hop,
            threshold: threshold
        )
        // Anything less and the cut would swallow the midpoint, which is how
        // the editor decides the word is gone: the transcript would strike out
        // a word still audible in the video.
        #expect(audible.1 >= 0.5)
        #expect(audible.1 < 0.55)
    }

    @Test("A word that sounds all the way through is left alone")
    func leavesSpeechAlone() {
        let loudness = envelope(soundSeconds: 0.5, total: 0.5)
        let audible = SpokenExtent.audible(
            word: (0, 0.5),
            loudness: loudness,
            hop: hop,
            threshold: threshold
        )
        #expect(audible.0 == 0)
        #expect(audible.1 == 0.5)
    }

    @Test("A word with no sound in it at all keeps its whole timing")
    func leavesMumblesAlone() {
        let loudness = [Double](repeating: -70, count: 50)
        let audible = SpokenExtent.audible(
            word: (0, 1.0),
            loudness: loudness,
            hop: hop,
            threshold: threshold
        )
        #expect(audible.0 == 0)
        #expect(audible.1 == 1.0)
    }

    @Test("The pause at the end of a sentence is now cut")
    func theFlatTailIsRemoved() {
        // A word sounding for 0.3s, reported as lasting 1.2s, then real speech.
        var loudness = [Double](repeating: -60, count: 100)
        for frame in 0 ..< 15 { loudness[frame] = -20 }
        for frame in 60 ..< 100 { loudness[frame] = -20 }
        let envelope = LoudnessEnvelope.Envelope(loudness: loudness, hop: hop)
        let words = [(0.0, 1.2), (1.2, 2.0)]

        let believingTheTranscript = SilenceScan.absorbingIslands(
            SilenceScan.avoiding(
                SilenceScan.silentRanges(loudness: loudness, hop: hop),
                words: words
            ),
            words: words
        )
        let measured = MeasuredSilence.ranges(envelope: envelope, words: words)

        let believed = believingTheTranscript.reduce(0) { $0 + ($1.1 - $1.0) }
        let heard = measured.reduce(0) { $0 + ($1.1 - $1.0) }
        // Believing the transcript, the whole 0.9s pause hides inside the word
        // that was said for the first 0.3s of it, and nothing is cut.
        #expect(believed < 0.1)
        // Measured, everything past that word's midpoint goes.
        #expect(heard > 0.5)
    }
}
