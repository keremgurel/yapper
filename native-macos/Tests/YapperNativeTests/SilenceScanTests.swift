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

    @Test("A cut never reaches into a word that is still spoken")
    func avoidsWords() {
        // A transcriber puts "if" at 10.0-10.4 while the sound starts at 10.2,
        // so measured quiet laps over its front. Cutting there takes the word's
        // attack and, worse, drags its midpoint into the removed side: the
        // transcript then strikes through a word that is still in the video.
        let ranges = SilenceScan.avoiding(
            [(9.0, 10.3)],
            words: [(10.0, 10.4)]
        )
        #expect(ranges.count == 1)
        #expect(ranges[0].0 == 9.0)
        #expect(ranges[0].1 == 10.0, "the cut stops where the word begins")
    }

    @Test("A word inside a long silence splits the cut around it")
    func splitsAroundWord() {
        let ranges = SilenceScan.avoiding([(0, 10)], words: [(4.0, 4.5)])
        #expect(ranges.count == 2)
        #expect(ranges[0] == (0, 4.0))
        #expect(ranges[1] == (4.5, 10))
    }

    @Test("Frames left over after the words are taken out are not worth a splice")
    func dropsCrumbs() {
        // 20ms of quiet between two words is not a cut, it is a click.
        #expect(SilenceScan.avoiding([(1.0, 1.02)], words: [(0.5, 1.0), (1.02, 1.5)]).isEmpty)
    }

    @Test("A sliver holding no speech goes with its neighbours")
    func absorbsIslands() {
        // Measured on a real take: 14 of 34 surviving clips were these, 0.16s
        // to 0.28s, and not one held a word. They are breaths and lip smacks,
        // loud enough to break a silence in two and worth nothing on a
        // timeline, so being audible is not enough to survive.
        for gap in [0.08, 0.2, 0.28, 0.5] {
            let ranges = SilenceScan.absorbingIslands(
                [(0, 2.0), (2.0 + gap, 4.0)],
                words: [(4.2, 4.6)]
            )
            #expect(ranges.count == 1, "a wordless \(gap)s island should not survive")
        }
    }

    @Test("A long wordless moment is left alone")
    func keepsLongIslands() {
        // A laugh, or a beat held on purpose. Wordless, and not ours to cut.
        let ranges = SilenceScan.absorbingIslands(
            [(0, 2.0), (2.9, 4.0)],
            words: [(4.2, 4.6)]
        )
        #expect(ranges.count == 2)
    }

    @Test("A sliver with a word in it stays")
    func keepsSpokenIslands() {
        // Short words are still words. "No." between two pauses must survive.
        let ranges = SilenceScan.absorbingIslands(
            [(0, 2.0), (2.1, 4.0)],
            words: [(2.0, 2.1)]
        )
        #expect(ranges.count == 2)
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
