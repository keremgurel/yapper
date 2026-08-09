import Foundation
import Testing

@testable import YapperNative

/// Core Animation interpolates between keyframes, so an opacity track that ends
/// on a 1 does not switch a layer off — it dims it across everything that
/// follows. That is what put four caption cards on screen at once in the first
/// export, so these check the shape of the track itself.
@Suite struct LayerVisibilityKeyframesTests {
    private func opacity(
        of track: LayerVisibilityKeyframes.Track,
        atFraction fraction: Double
    ) -> Double {
        guard let first = track.keyTimes.first, fraction > first else {
            return track.values.first ?? 0
        }
        for index in 1 ..< track.keyTimes.count {
            let previous = track.keyTimes[index - 1]
            let current = track.keyTimes[index]
            guard fraction <= current else { continue }
            guard current > previous else { return track.values[index] }
            let progress = (fraction - previous) / (current - previous)
            return track.values[index - 1] + progress * (track.values[index] - track.values[index - 1])
        }
        return track.values.last ?? 0
    }

    private var midCard: LayerVisibilityKeyframes.Track {
        LayerVisibilityKeyframes.make(start: 20, layerDuration: 1, compositionDuration: 100)
    }

    @Test func aCardIsFullyOnOnlyInsideItsOwnWindow() {
        let track = midCard
        #expect(opacity(of: track, atFraction: 0.205) == 1)
        #expect(opacity(of: track, atFraction: 0.1) == 0)
    }

    /// The regression: long after the card ends, it has to be gone rather than
    /// halfway through a fade that lasts until the credits.
    @Test func aCardIsCompletelyOffAfterItEnds() {
        let track = midCard
        #expect(opacity(of: track, atFraction: 0.3) == 0)
        #expect(opacity(of: track, atFraction: 0.6) == 0)
        #expect(opacity(of: track, atFraction: 1) == 0)
    }

    @Test func keyTimesRiseAndSpanTheWholeComposition() {
        for track in [
            midCard,
            LayerVisibilityKeyframes.make(start: 0, layerDuration: 2, compositionDuration: 10),
            LayerVisibilityKeyframes.make(start: 8, layerDuration: 2, compositionDuration: 10),
            LayerVisibilityKeyframes.make(start: 0, layerDuration: 10, compositionDuration: 10),
        ] {
            #expect(track.values.count == track.keyTimes.count)
            #expect(track.keyTimes.first == 0)
            #expect(track.keyTimes.last == 1)
            #expect(zip(track.keyTimes, track.keyTimes.dropFirst()).allSatisfy { $0 < $1 })
        }
    }

    @Test func aCardOnTheFirstFrameStartsVisible() {
        let track = LayerVisibilityKeyframes.make(start: 0, layerDuration: 2, compositionDuration: 10)
        #expect(opacity(of: track, atFraction: 0) == 1)
        #expect(opacity(of: track, atFraction: 0.1) == 1)
        #expect(opacity(of: track, atFraction: 0.5) == 0)
    }

    @Test func aCardOnTheLastFrameStaysVisibleToTheEnd() {
        let track = LayerVisibilityKeyframes.make(start: 8, layerDuration: 2, compositionDuration: 10)
        #expect(opacity(of: track, atFraction: 0.9) == 1)
        #expect(opacity(of: track, atFraction: 1) == 1)
        #expect(opacity(of: track, atFraction: 0.5) == 0)
    }

    @Test func aZeroLengthCompositionDrawsNothing() {
        let track = LayerVisibilityKeyframes.make(start: 0, layerDuration: 1, compositionDuration: 0)
        #expect(track.values.allSatisfy { $0 == 0 })
    }
}
