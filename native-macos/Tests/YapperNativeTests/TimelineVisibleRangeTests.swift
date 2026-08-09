import Foundation
import Testing
@testable import YapperNative

struct TimelineVisibleRangeTests {
    /// 60 seconds drawn across 6000 points: 100 points per second.
    private func range(scrollX: Double, viewportWidth: Double = 600) -> ClosedRange<Double> {
        TimelineVisibleRange.make(
            scrollX: scrollX,
            viewportWidth: viewportWidth,
            contentWidth: 6_000,
            duration: 60
        )
    }

    @Test func theRangeCarriesAViewportOfMarginOnEitherSide() {
        // Scrolled to 20s, showing 6s of timeline, so 6s of margin each side.
        let visible = range(scrollX: 2_000)
        #expect(visible.lowerBound == 14)
        #expect(visible.upperBound == 32)
    }

    @Test func scrollingWithinASecondReturnsTheSameRange() {
        // Whole-second rounding is what stops an ordinary scroll from
        // rebuilding every cell on the way past: the range only changes when
        // one of its edges crosses a second, at most once per second of scroll.
        #expect(range(scrollX: 2_010) == range(scrollX: 2_030))
        #expect(range(scrollX: 2_010) == range(scrollX: 2_099))
        #expect(range(scrollX: 2_010) != range(scrollX: 2_200))
    }

    @Test func theRangeStaysInsideTheProject() {
        let atStart = range(scrollX: 0)
        #expect(atStart.lowerBound == 0)
        let atEnd = range(scrollX: 5_400)
        #expect(atEnd.upperBound == 60)
    }

    @Test func anUnknownLayoutDrawsEverythingRatherThanNothing() {
        #expect(TimelineVisibleRange.make(
            scrollX: 0,
            viewportWidth: 0,
            contentWidth: 0,
            duration: 60
        ) == 0 ... 60)
        #expect(TimelineVisibleRange.make(
            scrollX: .nan,
            viewportWidth: 600,
            contentWidth: 6_000,
            duration: 60
        ) == 0 ... 60)
    }

    @Test func anItemCountsWhenAnyPartOfItIsInside() {
        let visible = 10.0 ... 20.0
        #expect(visible.showsItem(start: 12, duration: 1))       // wholly inside
        #expect(visible.showsItem(start: 5, duration: 6))        // overlaps the start
        #expect(visible.showsItem(start: 19, duration: 30))      // overlaps the end
        #expect(visible.showsItem(start: 0, duration: 60))       // spans it
        #expect(visible.showsItem(start: 10, duration: 0))       // a mark, not a gap
        #expect(!visible.showsItem(start: 21, duration: 2))
        #expect(!visible.showsItem(start: 0, duration: 9))
    }

    @Test func expensiveCellContentsAreWindowedToTheVisiblePart() {
        let visible = 10.0 ... 20.0
        #expect(visible.visibleFraction(start: 0, duration: 40) == 0.25 ... 0.5)
        #expect(visible.visibleFraction(start: 12, duration: 4) == 0 ... 1)
        #expect(visible.visibleFraction(start: 30, duration: 4) == 0 ... 0)
        #expect(visible.visibleFraction(start: 12, duration: 0) == 0 ... 0)
    }
}
