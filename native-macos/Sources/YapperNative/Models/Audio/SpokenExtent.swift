import Foundation

/// The part of a transcribed word that actually makes a sound.
///
/// `SilenceScan.avoiding` protects every word from being cut into, using the
/// timings the transcriber returned. Those timings are generous in one
/// direction: the last word of a phrase is regularly reported as running until
/// the speaker starts talking again. Measured on a fifteen minute take, 307
/// words carried 45 seconds of measured silence inside their own timings, and
/// ten of those seconds reached the finished cut as flat waveform sitting at
/// the end of a sentence.
///
/// So the protection is narrowed to where the sound is. The word keeps its
/// attack and its release; what it stops keeping is the pause it was never
/// speaking through.
enum SpokenExtent {
    /// Left on each side of the sound, so a soft consonant that sits under the
    /// line is not shaved off the front or back of a word.
    static let padding = 0.06

    static func audible(
        words: [(Double, Double)],
        loudness: [Double],
        hop: Double,
        threshold: Double,
        padding: Double = SpokenExtent.padding
    ) -> [(Double, Double)] {
        guard hop > 0, !loudness.isEmpty else { return words }
        return words.map {
            audible(
                word: $0,
                loudness: loudness,
                hop: hop,
                threshold: threshold,
                padding: padding
            )
        }
    }

    static func audible(
        word: (Double, Double),
        loudness: [Double],
        hop: Double,
        threshold: Double,
        padding: Double = SpokenExtent.padding
    ) -> (Double, Double) {
        guard hop > 0, word.1 > word.0 else { return word }
        // To the nearest frame, and no further. Reaching one frame past the end
        // borrows the first frame of whatever comes next, and what comes next
        // is usually the speaker starting again: the pause then measures as
        // sound and the word looks like it was spoken to its very last moment.
        let from = max(0, Int((word.0 / hop).rounded()))
        let to = min(loudness.count, max(from + 1, Int((word.1 / hop).rounded())))
        guard from < to else { return word }

        var first: Int?
        var last: Int?
        for index in from ..< to where loudness[index] > threshold {
            if first == nil { first = index }
            last = index
        }
        // Nothing above the line anywhere in the word means a mumble the
        // measurement cannot see, not an empty stretch. Leave it whole.
        guard let first, let last else { return word }

        // The midpoint stays protected, whatever the sound says. The editor
        // decides which words survive a cut by asking where their midpoint
        // landed, so a cut that swallowed one would strike a word off the
        // transcript that is still there in the video.
        let midpoint = (word.0 + word.1) / 2
        return (
            min(max(word.0, Double(first) * hop - padding), midpoint),
            max(min(word.1, Double(last + 1) * hop + padding), midpoint)
        )
    }
}
