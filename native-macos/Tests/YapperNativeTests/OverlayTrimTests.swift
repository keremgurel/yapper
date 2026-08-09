import Foundation
import SwiftUI
import Testing

@testable import YapperNative

/// Trimming a video overlay has to move its in point, not just its left edge.
/// Without that, dragging the start in only made the same footage begin later,
/// so nothing about what played ever changed.
struct OverlayTrimTests {
    private let contentWidth = 1000.0
    private let projectDuration = 100.0
    /// One second of video per ten points of drag, so a translation reads
    /// straight off as seconds.
    private let secondsPerPoint = 0.1

    private func overlay(
        start: Double = 10,
        duration: Double = 8,
        sourceStart: Double = 0
    ) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: start,
            duration: duration,
            sourceStart: sourceStart
        )
    }

    private func trimmed(
        _ overlay: ProjectOverlay,
        _ edge: HorizontalEdge,
        by seconds: Double,
        sourceDuration: Double? = 30
    ) -> ProjectOverlay {
        TimelineOverlayGeometry.trimmed(
            overlay: overlay,
            edge: edge,
            translationX: seconds / secondsPerPoint,
            contentWidth: contentWidth,
            projectDuration: projectDuration,
            sourceDuration: sourceDuration
        )
    }

    private func close(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 0.0005 }

    /// The bug as reported: drag the start in, and the footage has to lose its
    /// opening rather than starting the same frame two seconds later.
    @Test func trimmingTheStartMovesTheInPoint() {
        let result = trimmed(overlay(), .leading, by: 2)
        #expect(close(result.sourceStart, 2))
        #expect(close(result.timelineStart, 12))
        #expect(close(result.duration, 6))
        // The out point has not moved.
        #expect(close(result.timelineStart + result.duration, 18))
    }

    @Test func draggingTheStartBackAgainRestoresWhatWasTrimmed() {
        let trimmedIn = trimmed(overlay(), .leading, by: 2)
        let restored = trimmed(trimmedIn, .leading, by: -2)
        #expect(close(restored.sourceStart, 0))
        #expect(close(restored.timelineStart, 10))
        #expect(close(restored.duration, 8))
    }

    /// The in point cannot go behind the head of the footage.
    @Test func theStartCannotBePulledBackPastTheFootage() {
        let result = trimmed(overlay(sourceStart: 1), .leading, by: -5)
        #expect(result.sourceStart >= 0)
        #expect(close(result.sourceStart, 0))
    }

    /// Nor can the cell be pulled back off the front of the video.
    @Test func theStartCannotBePulledOffTheFrontOfTheVideo() {
        let result = trimmed(overlay(start: 1, sourceStart: 6), .leading, by: -5)
        #expect(result.timelineStart >= 0)
        #expect(close(result.timelineStart, 0))
        #expect(close(result.sourceStart, 5))
    }

    @Test func theEndStopsWhereTheFootageRunsOut() {
        // 8 seconds used of 30 available, dragged out by 40.
        let result = trimmed(overlay(), .trailing, by: 40, sourceDuration: 30)
        #expect(close(result.duration, 30))
        #expect(close(result.sourceStart, 0))
    }

    @Test func theEndStopsWhereTheFootageRunsOutFromALaterInPoint() {
        let result = trimmed(overlay(sourceStart: 22), .trailing, by: 40, sourceDuration: 30)
        #expect(close(result.duration, 8))
    }

    @Test func neitherEdgeCanCollapseTheCell() {
        #expect(trimmed(overlay(), .leading, by: 99).duration > 0)
        #expect(trimmed(overlay(), .trailing, by: -99).duration > 0)
    }

    /// A still shows the same picture whenever it is played, so its edges only
    /// decide how long it is up. Advancing an in point it does not have would
    /// push a one-frame image off its own end.
    @Test func aStillHasNoInPointToMove() {
        let result = trimmed(overlay(), .leading, by: 2, sourceDuration: nil)
        #expect(close(result.sourceStart, 0))
        #expect(close(result.timelineStart, 12))
        #expect(close(result.duration, 6))
    }

    /// A still can be held up for as long as the video lasts.
    @Test func aStillCanBeStretchedPastAnyFootageLength() {
        let result = trimmed(overlay(), .trailing, by: 40, sourceDuration: nil)
        #expect(close(result.duration, 48))
    }

    /// Footage saved before trimming was source-aware can already claim more
    /// than the file holds. That is what it is showing, so it is the floor
    /// rather than something to yank shorter the moment an edge is touched.
    @Test func anOverlayAlreadyLongerThanItsSourceIsNotYankedShorter() {
        let long = overlay(duration: 40)
        let result = trimmed(long, .trailing, by: 0, sourceDuration: 30)
        #expect(close(result.duration, 40))
    }
}
