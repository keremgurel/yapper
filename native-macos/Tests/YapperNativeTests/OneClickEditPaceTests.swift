import Foundation
import Testing
@testable import YapperNative

struct OneClickEditPaceTests {
    private let take = OneClickEditPace(words: 1_888, mediaSeconds: 780)

    @Test("the retake step is paced by how much there is to read")
    func retakeStepScalesWithWords() {
        let short = OneClickEditPace(words: 472, mediaSeconds: 311)
        #expect(short.expectedSeconds(for: .removingRetakes) < take.expectedSeconds(for: .removingRetakes))
        // Measured: 1,888 words took about four minutes.
        #expect(abs(take.expectedSeconds(for: .removingRetakes) - 245) < 30)
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
