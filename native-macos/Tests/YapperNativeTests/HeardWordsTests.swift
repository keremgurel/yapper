import Foundation
import Testing
@testable import YapperNative

struct HeardWordsTests {
    private static let media = UUID()

    private static func word(_ text: String, _ span: ClosedRange<Double>) -> TranscriptWord {
        TranscriptWord(mediaID: media, text: text, start: span.lowerBound, end: span.upperBound)
    }

    /// The real timings from an eighteen minute take: the speaker said each of
    /// these once, and the transcriber wrote each twice over the same instant.
    @Test("a word written twice over the same moment is kept once")
    func dropsOverlappingDoubles() {
        let heard = HeardWords.withoutDoubledEmissions([
            Self.word("15%", 870.340 ... 871.140),
            Self.word("on", 871.140 ... 871.380),
            Self.word("on", 871.165 ... 871.405),
            Self.word("a", 871.380 ... 871.540),
            Self.word("a", 871.405 ... 871.485),
            Self.word("monthly", 871.540 ... 871.780),
        ])
        #expect(heard.map { $0.text } == ["15%", "on", "a", "monthly"])
        // The surviving word covers the pair, so nothing loses its audio.
        #expect(heard[1].end == 871.405)
    }

    /// A word the speaker really did say twice does not overlap itself.
    @Test("a word genuinely said twice is left alone")
    func keepsRealRepeats() {
        let heard = HeardWords.withoutDoubledEmissions([
            Self.word("here", 544.020 ... 544.340),
            Self.word("you'll", 544.340 ... 544.580),
            Self.word("here", 544.580 ... 544.980),
            Self.word("you'll", 545.140 ... 545.460),
        ])
        #expect(heard.count == 4)
    }

    @Test("punctuation and case do not hide a double")
    func ignoresSpelling() {
        let heard = HeardWords.withoutDoubledEmissions([
            Self.word("plan.", 872.320 ... 872.800),
            Self.word("Plan", 872.775 ... 872.900),
        ])
        #expect(heard.map { $0.text } == ["plan."])
    }

    @Test("a different word at the same moment stays")
    func keepsDifferentWords() {
        let heard = HeardWords.withoutDoubledEmissions([
            Self.word("on", 871.140 ... 871.380),
            Self.word("a", 871.165 ... 871.405),
        ])
        #expect(heard.count == 2)
    }
}
