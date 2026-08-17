import Foundation
import Testing
@testable import YapperNative

/// The timestamps strip draws what is on screen and not the rest of the
/// timeline behind it.
@Suite
struct TimelineRulerTicksTests {
    @Test("A zoomed timeline only costs its viewport")
    func drawsTheViewportNotTheTimeline() {
        // Two minutes at a close zoom: forty thousand points of strip, of
        // which twelve hundred are on screen.
        let all = TimelineRulerTicks.ticks(
            duration: 120,
            width: 40_000,
            visible: 0 ... 40_000
        )
        let shown = TimelineRulerTicks.ticks(
            duration: 120,
            width: 40_000,
            visible: TimelineRulerTicks.window(scrollX: 20_000, viewportWidth: 1_200)
        )
        // 601 marks across the strip against 37 on screen, and every fifth one
        // of those lays out a timestamp.
        #expect(all.count > 500)
        #expect(shown.count < all.count / 8)
        #expect(!shown.isEmpty)
    }

    @Test("Which marks are long does not change as the strip scrolls")
    func majorsStayPutWhileScrolling() {
        let near = TimelineRulerTicks.ticks(
            duration: 120,
            width: 12_000,
            visible: 6_000 ... 7_200
        )
        let far = TimelineRulerTicks.ticks(
            duration: 120,
            width: 12_000,
            visible: 0 ... 12_000
        )
        for tick in near {
            let same = far.first { abs($0.time - tick.time) < 0.000_1 }
            #expect(same?.isMajor == tick.isMajor)
        }
    }

    @Test("The drawn window covers the viewport with a page either side")
    func windowSurroundsTheViewport() {
        let window = TimelineRulerTicks.window(scrollX: 5_000, viewportWidth: 1_000)
        #expect(window.lowerBound <= 5_000)
        #expect(window.upperBound >= 6_000)
        // Unchanged while scrolling inside the page it already drew.
        #expect(TimelineRulerTicks.window(scrollX: 5_400, viewportWidth: 1_000) == window)
    }

    @Test("Nothing is drawn past the end of the take")
    func stopsAtTheEnd() {
        let ticks = TimelineRulerTicks.ticks(
            duration: 10,
            width: 1_000,
            visible: 0 ... 5_000
        )
        #expect(ticks.allSatisfy { $0.time <= 10.001 })
        #expect(ticks.first?.time == 0)
    }

    @Test("An empty timeline draws nothing")
    func emptyTimeline() {
        #expect(TimelineRulerTicks.ticks(duration: 0, width: 800, visible: 0 ... 800).isEmpty)
        #expect(TimelineRulerTicks.ticks(duration: 10, width: 0, visible: 0 ... 800).isEmpty)
    }
}
