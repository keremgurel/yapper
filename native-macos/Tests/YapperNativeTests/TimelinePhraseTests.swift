import Foundation
import Testing
@testable import YapperNative

/// Quoted phrases against a cut whose edges land inside words.
struct TimelinePhraseTests {
    private let mediaID = UUID()

    /// "Comment TEF and I'll send you the link", with "link" running from
    /// 266.51 to 266.75 the way the TEF ad's transcript has it.
    private var takeWords: [TranscriptWord] {
        let spoken: [(String, Double, Double)] = [
            ("Comment", 264.20, 264.55), ("TEF", 264.60, 264.95), ("and", 265.00, 265.12),
            ("I'll", 265.15, 265.35), ("send", 265.40, 265.70), ("you", 265.75, 265.90),
            ("the", 266.30, 266.45), ("link", 266.51, 266.75),
        ]
        return spoken.map { TranscriptWord(mediaID: mediaID, text: $0.0, start: $0.1, end: $0.2) }
    }

    private func anchor(_ phrase: String, occurrence: Int? = nil) -> TimelineAnchorInput {
        TimelineAnchorInput(kind: .phrase, time: nil, phrase: phrase, occurrence: occurrence, eventID: nil, offset: nil)
    }

    private func project(_ clips: [TimelineClip], words: [TranscriptWord]) -> EditorProject {
        var project = EditorProject(clips: clips)
        project.transcript = words
        return project
    }

    @Test func aLastWordCutPastItsMiddleStillEndsThePhrase() throws {
        let cut = project([TimelineClip(mediaID: mediaID, sourceStart: 264, sourceEnd: 266.62)], words: takeWords)
        let quote = anchor("Comment TEF and I'll send you the link")

        let start = try TimelineCue.resolve(quote, project: cut, playhead: 0)
        let end = try TimelineCue.resolve(quote, project: cut, playhead: 0, edge: .end)
        #expect(abs(start - 0.20) < 1e-9)
        // The kept part of "link" ends where the clip does.
        #expect(abs(end - 2.62) < 1e-9)
        // The ordinary kept speech still leaves it out.
        #expect(TimelineCue.words(in: cut).map(\.text).last == "the")
    }

    @Test func aFirstWordCutPastItsMiddleStillOpensThePhrase() throws {
        let cut = project([TimelineClip(mediaID: mediaID, sourceStart: 264.45, sourceEnd: 267)], words: takeWords)
        let start = try TimelineCue.resolve(anchor("Comment TEF"), project: cut, playhead: 0)
        #expect(abs(start - 0) < 1e-9)
    }

    @Test func aPartlyKeptWordCannotSitInsideAPhrase() {
        // Two clips that each lose the middle of "send", so it is partial on
        // both sides and kept in neither.
        let cut = project([
            TimelineClip(mediaID: mediaID, sourceStart: 264, sourceEnd: 265.50),
            TimelineClip(mediaID: mediaID, sourceStart: 265.62, sourceEnd: 267),
        ], words: takeWords)
        #expect(TimelinePhrase.matches("I'll send you", in: cut).isEmpty)
        // Each end of the gap is still a usable edge on its own.
        #expect(TimelinePhrase.matches("and I'll send", in: cut).count == 1)
        #expect(TimelinePhrase.matches("send you the", in: cut).count == 1)
    }

    @Test func aCutRetakeNeverMatchesThroughASliver() throws {
        // A retake at 250 that was cut away, ending in a "link" whose last
        // 10 ms spill into the kept take's clip.
        let retake = [
            TranscriptWord(mediaID: mediaID, text: "the", start: 263.60, end: 263.80),
            TranscriptWord(mediaID: mediaID, text: "link", start: 263.85, end: 264.21),
        ]
        let cut = project([TimelineClip(mediaID: mediaID, sourceStart: 264.20, sourceEnd: 267)], words: retake + takeWords)
        #expect(TimelinePhrase.matches("the link", in: cut).count == 1)
        let start = try TimelineCue.resolve(anchor("link"), project: cut, playhead: 0)
        #expect(abs(start - 2.31) < 1e-9)
    }

    @Test func aWordKeptInTheNextClipIsNotAlsoAPartialOfThisOne() throws {
        // A plain split inside "link": its midpoint lands in the second clip.
        let cut = project([
            TimelineClip(mediaID: mediaID, sourceStart: 264, sourceEnd: 266.62),
            TimelineClip(mediaID: mediaID, sourceStart: 266.62, sourceEnd: 267),
        ], words: takeWords)
        #expect(TimelinePhrase.matches("link", in: cut).count == 1)
        #expect(TimelinePhrase.matches("the link", in: cut).count == 1)
    }

    @Test func aMomentHasNoSeparateEnd() throws {
        let cut = project([TimelineClip(mediaID: mediaID, sourceStart: 264, sourceEnd: 267)], words: takeWords)
        let time = TimelineAnchorInput(kind: .time, time: 1.5, phrase: nil, occurrence: nil, eventID: nil, offset: 0.25)
        #expect(try TimelineCue.resolve(time, project: cut, playhead: 0, edge: .end) == 1.75)
    }
}
