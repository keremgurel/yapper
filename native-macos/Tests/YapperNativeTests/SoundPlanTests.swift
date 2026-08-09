import Foundation
import Testing

@testable import YapperNative

/// The sound library is fixed and the model names effects in whatever words it
/// likes, so everything here is a lookup with a hard floor. A cha-ching where
/// somebody asked for an airhorn is worse than silence.
struct SoundPlanTests {
    @Test func aLibraryIdOrNameIsFoundExactly() {
        #expect(SoundPlan.effect(named: "pop")?.id == "pop")
        #expect(SoundPlan.effect(named: "Pop")?.id == "pop")
        #expect(SoundPlan.effect(named: "cheek-pop")?.id == "cheek-pop")
        #expect(SoundPlan.effect(named: "Cheek pop")?.id == "cheek-pop")
        #expect(SoundPlan.effect(named: "camera-shutter")?.id == "camera-shutter")
    }

    /// "Add a pop sound" is how a person says it, and the words around the name
    /// are not part of the name.
    @Test func theWordsAroundTheNameAreIgnored() {
        #expect(SoundPlan.effect(named: "a pop sound")?.id == "pop")
        #expect(SoundPlan.effect(named: "the whoosh effect")?.id == "whoosh")
        #expect(SoundPlan.effect(named: "  POP  ")?.id == "pop")
    }

    @Test func theObviousSynonymsResolve() {
        #expect(SoundPlan.effect(named: "shutter")?.id == "camera-shutter")
        #expect(SoundPlan.effect(named: "cash")?.id == "cha-ching")
        #expect(SoundPlan.effect(named: "applause")?.id == "crowd-cheer")
        #expect(SoundPlan.effect(named: "drumroll")?.id == "drum-roll")
    }

    /// Longest name first, or "cheek pop" inside a sentence loses to "pop".
    @Test func theMoreSpecificNameWins() {
        #expect(SoundPlan.effect(named: "give me a cheek pop there")?.id == "cheek-pop")
        #expect(SoundPlan.effect(named: "a keyboard typing bed")?.id == "keyboard-typing")
    }

    @Test func anEffectNobodyHasResolvesToNothing() {
        #expect(SoundPlan.effect(named: "airhorn") == nil)
        #expect(SoundPlan.effect(named: "vine boom") == nil)
        #expect(SoundPlan.effect(named: "") == nil)
        #expect(SoundPlan.effect(named: "   ") == nil)
    }

    @Test func everyCutIsRecognisedHoweverItIsPhrased() {
        #expect(SoundPlan.isEveryCut(SoundRequest(effect: "whoosh", every: "cut")))
        #expect(SoundPlan.isEveryCut(SoundRequest(effect: "whoosh", every: "every cut")))
        #expect(SoundPlan.isEveryCut(SoundRequest(effect: "whoosh", every: "each clip")))
        #expect(!SoundPlan.isEveryCut(SoundRequest(effect: "whoosh")))
        #expect(!SoundPlan.isEveryCut(SoundRequest(effect: "whoosh", every: "word")))
    }

    /// The joins between clips, and never zero. The start of the video is not a
    /// cut, and a whoosh on the first frame is a whoosh over the hook.
    @Test func cutsAreTheJoinsAndNotTheStart() {
        #expect(SoundPlan.cutTimes(clipDurations: [2, 3, 1.5]) == [2, 5])
        #expect(SoundPlan.cutTimes(clipDurations: [4]).isEmpty)
        #expect(SoundPlan.cutTimes(clipDurations: []).isEmpty)
    }

    @Test func twoSoundsOnOneFrameBecomeOne() {
        #expect(SoundPlan.spaced([1.0, 1.02, 2.0]) == [1.0, 2.0])
        #expect(SoundPlan.spaced([2.0, 1.0]) == [1.0, 2.0])
        #expect(SoundPlan.spaced([]).isEmpty)
    }

    @Test func aTimeTheCreatorWroteIsRead() {
        #expect(SoundPlan.statedTimes(in: "add a cha-ching at 0:12") == [12])
        #expect(SoundPlan.statedTimes(in: "put a pop at 1:05") == [65])
        #expect(SoundPlan.statedTimes(in: "a whoosh at 1:05:30") == [3930])
        #expect(SoundPlan.statedTimes(in: "a pop at 12 seconds") == [12])
        #expect(SoundPlan.statedTimes(in: "a pop at 12s") == [12])
        #expect(SoundPlan.statedTimes(in: "a riser at 2 minutes") == [120])
        #expect(SoundPlan.statedTimes(in: "pop at 4.5 sec") == [4.5])
        #expect(SoundPlan.statedTimes(in: "a pop at 0:12 and a whoosh at 0:30") == [12, 30])
    }

    @Test func aSentenceWithNoTimeInItHasNone() {
        #expect(SoundPlan.statedTimes(in: "add a pop when I say Instagram").isEmpty)
        #expect(SoundPlan.statedTimes(in: "put a whoosh on every cut").isEmpty)
    }

    /// The one place a second is allowed through, and only because the creator
    /// typed it. A time the model worked out for itself is a time it counted,
    /// which is the whole thing this pipeline is built to avoid.
    @Test func onlyATimeTheCreatorStatedIsHonoured() {
        let instruction = "add a cha-ching at 0:12"
        #expect(
            SoundPlan.statedTime(
                for: SoundRequest(effect: "cha-ching", at: 12),
                in: instruction
            ) == 12
        )
        // A number nobody asked for.
        #expect(
            SoundPlan.statedTime(
                for: SoundRequest(effect: "cha-ching", at: 47),
                in: instruction
            ) == nil
        )
        // No number at all in the sentence.
        #expect(
            SoundPlan.statedTime(
                for: SoundRequest(effect: "pop", at: 12),
                in: "add a pop when I say Instagram"
            ) == nil
        )
        // Nothing asked for a time.
        #expect(
            SoundPlan.statedTime(for: SoundRequest(effect: "pop"), in: instruction) == nil
        )
    }

    @Test func requestsWithoutAnEffectAreDropped() {
        let raw: [Any] = [
            ["effect": "pop", "quote": "hello there"],
            ["quote": "no effect named"],
            ["effect": "   "],
            "not an object",
            ["effect": "whoosh", "every": "cut"],
        ]
        let requests = SoundPlan.parseRequests(raw)
        #expect(requests.map(\.effect) == ["pop", "whoosh"])
        #expect(requests[0].quote == "hello there")
        #expect(requests[1].every == "cut")
    }
}
