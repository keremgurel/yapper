@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// The instructions have to reach the last instant of the composition.
///
/// AVFoundation refuses a video composition that leaves any moment uncovered,
/// and it refuses the whole thing: an eighteen minute edit with eighty-five
/// cuts failed to export in under a second, saying only "The video could not
/// be composed." What it objected to was a millisecond and a half at the end.
struct CompositionCoversItselfTests {
    /// Seconds that came from a time on the composition's own clock, and so
    /// cannot be turned back into one by truncation.
    @Test("a time off the composition's clock survives the round trip")
    func roundTripKeepsTheLastTick() {
        let scale = CompositionBuilder.timeScale
        for ticks in [121_396, 1, 599, 600, 121_395, 987_654] {
            let exact = CMTime(value: CMTimeValue(ticks), timescale: scale)
            #expect(CompositionBuilder.tick(exact.seconds) == exact)
        }
    }

    /// The measured failure: 121396/600 is 202.326666…, and multiplied out
    /// that is 121395.99999…, which truncating sends to the tick below.
    @Test("truncation is what lost the last tick")
    func truncationIsTheProblem() {
        let exact = CMTime(value: 121_396, timescale: CompositionBuilder.timeScale)
        let truncated = CMTime(seconds: exact.seconds, preferredTimescale: CompositionBuilder.timeScale)
        #expect(truncated.value == 121_395)
        #expect(CompositionBuilder.tick(exact.seconds).value == 121_396)
    }

    /// The last boundary is the end of the composition, whatever sits near it.
    @Test("the final boundary is never dropped as a duplicate")
    func lastBoundaryIsTheEnd() {
        let duration = 202.3267
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: [50, 120, 202.3250],
            overlays: [],
            duration: duration
        )
        #expect(boundaries.last == duration)
    }
}
