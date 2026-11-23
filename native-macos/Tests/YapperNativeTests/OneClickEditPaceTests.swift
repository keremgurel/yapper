import Foundation
import Testing
@testable import YapperNative

struct OneClickEditPaceTests {
    private let take = OneClickEditPace(words: 1_888, mediaSeconds: 780)

    @Test("the retake step is paced by how much there is to read")
    func retakeStepScalesWithWords() {
        let short = OneClickEditPace(words: 472, mediaSeconds: 311)
        #expect(short.expectedSeconds(for: .removingRetakes) < take.expectedSeconds(for: .removingRetakes))
    }

    @Test(
        "the retake step expects what a call measured",
        arguments: [(544, 38.0), (1_399, 85.0), (2_891, 115.0)]
    )
    func retakeStepMatchesMeasuredCalls(words: Int, seconds: Double) {
        let pace = OneClickEditPace(words: words, mediaSeconds: 600)
        #expect(abs(pace.expectedSeconds(for: .removingRetakes) - seconds) < 1)
    }

    @Test("the retake step stops growing where the server stops adding room")
    func retakeStepLevelsOff() {
        let long = OneClickEditPace(words: 6_000, mediaSeconds: 3_000)
        let longer = OneClickEditPace(words: 12_000, mediaSeconds: 6_000)
        #expect(long.expectedSeconds(for: .removingRetakes) == 210)
        #expect(longer.expectedSeconds(for: .removingRetakes) == 210)
    }

    @Test("a few words still get a retake step long enough to watch")
    func shortTakeHasAFloor() {
        let tiny = OneClickEditPace(words: 40, mediaSeconds: 20)
        #expect(tiny.expectedSeconds(for: .removingRetakes) == 15)
    }

    @Test("transcribing expects what the 24.6 minute take measured")
    func transcribingMatchesTheMeasuredRun() {
        let measured = OneClickEditPace(words: 0, mediaSeconds: 1_476)
        #expect(abs(measured.expectedSeconds(for: .transcribing) - 52) < 2)
    }

    @Test("the steps after the retake call are expected to be brief")
    func lateStepsAreBrief() {
        let long = OneClickEditPace(words: 2_891, mediaSeconds: 1_476)
        for stage in [OneClickEditStage.cuttingPauses, .trimmingSilence, .addingCaptions] {
            #expect(long.expectedSeconds(for: stage) <= 2)
        }
    }

    @Test("a take with no transcript yet still gets a moving bar")
    func unknownTakeStillMoves() {
        #expect(OneClickEditPace.unknown.fraction(for: .removingRetakes, elapsed: 10) > 0)
    }

    @Test("progress never claims the step is done")
    func neverReachesTheEnd() {
        for elapsed in [1.0, 60, 600, 6_000] {
            let value = take.fraction(for: .removingRetakes, elapsed: elapsed)
            #expect(value > 0 && value < 1)
        }
        #expect(take.fraction(for: .removingRetakes, elapsed: 0) == 0)
    }

    @Test("progress only ever moves forward")
    func movesForward() {
        var previous = 0.0
        for elapsed in stride(from: 1.0, through: 400, by: 7) {
            let value = take.fraction(for: .removingRetakes, elapsed: elapsed)
            #expect(value >= previous)
            previous = value
        }
    }
}
