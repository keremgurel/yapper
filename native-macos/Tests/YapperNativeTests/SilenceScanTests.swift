import Foundation
import Testing
@testable import YapperNative

/// What the trimmer keeps and what it takes.
///
/// Both directions are load-bearing. Too gentle and a second of dead air
/// survives every pass, which is what sent this work back twice. Too eager and
/// it eats the beat between sentences, which cannot be undone by watching the
/// result: it just sounds wrong.
@Suite
struct SilenceScanTests {
    private let hop = 0.02

    /// A take: `speech` and `quiet` in seconds, in order.
    private func take(_ parts: [(Double, Bool)]) -> [Double] {
        parts.flatMap { seconds, isSpeech in
            Array(repeating: isSpeech ? -14.0 : -68.0, count: Int(seconds / hop))
        }
    }

    private func total(_ ranges: [(Double, Double)]) -> Double {
        ranges.reduce(0) { $0 + ($1.1 - $1.0) }
    }

    @Test("Dead air at the head and tail goes almost entirely")
    func edges() {
        // The screenshot that started this: a second of flat waveform at each
        // end of a take, which the transcript reported as a gap too small to
        // cut.
        let ranges = SilenceScan.silentRanges(
            loudness: take([(1.0, false), (3.0, true), (1.2, false)]),
            hop: hop
        )
        #expect(ranges.count == 2)
        let head = ranges[0]
        #expect(head.0 == 0)
        #expect(head.1 > 0.9, "the head should go, less a hair of padding")
        let tail = ranges[1]
        #expect(tail.1 > 5.1)
        #expect(total(ranges) > 2.0)
    }

    @Test("A pause between sentences goes, and keeps its edges")
    func middle() {
        let ranges = SilenceScan.silentRanges(
            loudness: take([(2.0, true), (0.8, false), (2.0, true)]),
            hop: hop
        )
        #expect(ranges.count == 1)
        // Padding on both sides, so the words either side keep their attack.
        #expect(ranges[0].0 > 2.0)
        #expect(ranges[0].1 < 2.8)
        #expect(total(ranges) > 0.6)
    }

    @Test("The beat between words stays")
    func keepsRhythm() {
        // 100ms between words is speech, not silence. Cutting it is what makes
        // an edit sound like a machine made it.
        let ranges = SilenceScan.silentRanges(
            loudness: take([(1.0, true), (0.1, false), (1.0, true)]),
            hop: hop
        )
        #expect(ranges.isEmpty)
    }

    @Test("Quiet is relative to how the take was recorded")
    func relativeToSpeech() {
        // A quiet recording: speech at -40 dB, room tone at -66. A fixed
        // threshold would call the whole thing silence.
        let quiet = [Double](repeating: -40, count: 150)
            + [Double](repeating: -66, count: 50)
            + [Double](repeating: -40, count: 150)
        let ranges = SilenceScan.silentRanges(loudness: quiet, hop: hop)
        #expect(ranges.count == 1)
        #expect(total(ranges) > 0.7)
    }

    @Test("A take with no quiet in it is left alone")
    func allSpeech() {
        #expect(SilenceScan.silentRanges(loudness: take([(4.0, true)]), hop: hop).isEmpty)
    }

    @Test("Nothing to measure, nothing to cut")
    func empty() {
        #expect(SilenceScan.silentRanges(loudness: [], hop: hop).isEmpty)
        #expect(SilenceScan.silentRanges(loudness: [-50, -50], hop: 0).isEmpty)
    }

    @Test("The threshold sits under the talking, not under the pauses")
    func threshold() {
        // Mostly pauses: the median is silence, and a threshold taken from it
        // would cut nothing at all.
        let mostlyQuiet = [Double](repeating: -70, count: 800)
            + [Double](repeating: -12, count: 200)
        let line = SilenceScan.threshold(
            loudness: mostlyQuiet,
            settings: SilenceScan.Settings()
        )
        #expect(line > -70)
        #expect(line <= -34)
    }
}
