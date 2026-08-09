import Foundation
import Testing

@testable import YapperNative

/// "Show the icon right as I say Instagram." The quote finds the sentence and
/// the cue finds the word inside it, because a whole transcript has four
/// Instagrams in it and only one of them is the moment being described.
struct OverlayCueTests {
    private let mediaID = UUID()

    private func words(_ text: String) -> [TranscriptWord] {
        text.split(separator: " ").enumerated().map { index, token in
            TranscriptWord(
                mediaID: mediaID,
                text: String(token),
                start: Double(index) * 0.4,
                end: Double(index) * 0.4 + 0.35
            )
        }
    }

    private let sentence = "you can find me on Instagram and TikTok every single day of the week"

    @Test func aCueLandsOnItsOwnWord() {
        let transcript = words(sentence)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 8, cue: "Instagram") == 5)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 8, cue: "TikTok") == 7)
    }

    @Test func punctuationAndCaseDoNotMatter() {
        let transcript = words("find me on Instagram, and on TikTok.")
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 6, cue: "instagram") == 3)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 6, cue: "TIKTOK") == 6)
    }

    /// Transcripts are full of possessives and plurals the model drops when it
    /// copies a name out, and a miss there would send the icon back to the top
    /// of the sentence for no good reason.
    @Test func aPossessiveOrPluralIsStillTheSameWord() {
        let transcript = words("my Instagram's link is in the bio")
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 6, cue: "Instagram") == 1)
    }

    @Test func aTwoWordCueIsFound() {
        let transcript = words("this is the reddit automation I built last month")
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 7, cue: "reddit automation") == 3)
    }

    /// The search is the span, not the transcript. A cue is one word, and one
    /// word matched against nine hundred lands anywhere.
    @Test func aCueOutsideTheSpanIsNotFound() {
        let transcript = words("first I say Instagram and much later I say TikTok")
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 4, cue: "TikTok") == nil)
        #expect(OverlayCue.anchor(in: transcript, span: 5 ... 9, cue: "TikTok") == 9)
    }

    @Test func aCueThatIsNotThereGivesNothingRatherThanAGuess() {
        let transcript = words(sentence)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 8, cue: "YouTube") == nil)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 8, cue: "") == nil)
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 8, cue: "   ") == nil)
    }

    /// A short word is only ever an exact match. "on" must not find "one".
    @Test func aShortCueIsNotStemMatched() {
        let transcript = words("one of the things")
        #expect(OverlayCue.anchor(in: transcript, span: 0 ... 3, cue: "on") == nil)
    }

    @Test func theOverlayIsOnScreenBeforeTheWordIsHeard() {
        #expect(OverlayCue.start(forWordAt: 4.0) == 4.0 - OverlayCue.leadIn)
        // Never before the video starts.
        #expect(OverlayCue.start(forWordAt: 0.05) == 0)
        #expect(OverlayCue.start(forWordAt: 0) == 0)
    }
}
