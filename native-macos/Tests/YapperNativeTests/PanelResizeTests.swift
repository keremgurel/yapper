import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct PanelResizeTests {
    private let bounds = CGSize(width: 1_200, height: 900)
    private let minimum = CGSize(width: 320, height: 220)
    private let size = CGSize(width: 560, height: 460)
    private let anchor = AssistantAnchor(x: 400, y: 300)

    private func resize(
        _ edge: PanelResizeEdge,
        by translation: CGSize
    ) -> (anchor: AssistantAnchor, size: CGSize) {
        PanelResizeGeometry.resized(
            anchor: anchor,
            size: size,
            edge: edge,
            translation: translation,
            minimum: minimum,
            within: bounds
        )
    }

    @Test func pullingTheTrailingEdgeWidensItAndLeavesTheCornerAlone() {
        let result = resize(.trailing, by: CGSize(width: 80, height: 0))
        #expect(result.size.width == 640)
        #expect(result.size.height == 460)
        #expect(result.anchor == anchor)
    }

    @Test func pullingTheLeadingEdgeWidensItAndMovesTheCornerToMatch() {
        let result = resize(.leading, by: CGSize(width: -80, height: 0))
        #expect(result.size.width == 640)
        // The right edge has to stay exactly where it was, or the panel slides
        // out from under the pointer as it grows.
        #expect(result.anchor.x + result.size.width == anchor.x + size.width)
        #expect(result.anchor.x == 320)
    }

    @Test func pullingTheTopEdgeGrowsUpwardWithTheBottomEdgePinned() {
        let result = resize(.top, by: CGSize(width: 0, height: -100))
        #expect(result.size.height == 560)
        #expect(result.anchor.y + result.size.height == anchor.y + size.height)
        #expect(result.anchor.y == 200)
    }

    @Test func pullingTheBottomEdgeGrowsDownwardOnly() {
        let result = resize(.bottom, by: CGSize(width: 0, height: 90))
        #expect(result.size.height == 550)
        #expect(result.anchor == anchor)
    }

    @Test func aCornerTakesBothAxesAtOnce() {
        let result = resize(.topLeading, by: CGSize(width: -50, height: -60))
        #expect(result.size.width == 610)
        #expect(result.size.height == 520)
        #expect(result.anchor.x == 350)
        #expect(result.anchor.y == 240)
    }

    @Test func everyEdgeChangesOnlyWhatItIsAnEdgeOf() {
        for edge in [PanelResizeEdge.top, .bottom] {
            let result = resize(edge, by: CGSize(width: 200, height: 0))
            #expect(result.size.width == size.width, "\(edge) changed the width")
        }
        for edge in [PanelResizeEdge.leading, .trailing] {
            let result = resize(edge, by: CGSize(width: 0, height: 200))
            #expect(result.size.height == size.height, "\(edge) changed the height")
        }
    }

    // MARK: - Limits

    @Test func nothingCanBeSqueezedPastItsMinimum() {
        let squeezed = resize(.trailing, by: CGSize(width: -9_000, height: 0))
        #expect(squeezed.size.width == minimum.width)

        let flattened = resize(.bottom, by: CGSize(width: 0, height: -9_000))
        #expect(flattened.size.height == minimum.height)
    }

    @Test func squeezingFromTheLeadingEdgeStillPinsTheRightEdge() {
        let squeezed = resize(.leading, by: CGSize(width: 9_000, height: 0))
        #expect(squeezed.size.width == minimum.width)
        #expect(squeezed.anchor.x + squeezed.size.width == anchor.x + size.width)
    }

    @Test func nothingCanBeGrownPastTheWindow() {
        let wide = resize(.trailing, by: CGSize(width: 9_000, height: 0))
        #expect(wide.anchor.x + wide.size.width <= bounds.width - AssistantAnchor.margin)

        let tall = resize(.bottom, by: CGSize(width: 0, height: 9_000))
        #expect(tall.anchor.y + tall.size.height <= bounds.height - AssistantAnchor.margin)
    }

    @Test func growingUpwardStopsAtTheTopOfTheWindow() {
        let tall = resize(.top, by: CGSize(width: 0, height: -9_000))
        #expect(tall.anchor.y >= AssistantAnchor.margin)
        // And what it gained upward it did not also lose at the bottom.
        #expect(tall.anchor.y + tall.size.height <= anchor.y + size.height + 0.001)
    }

    @Test func growingLeftwardStopsAtTheEdgeOfTheWindow() {
        let wide = resize(.leading, by: CGSize(width: -9_000, height: 0))
        #expect(wide.anchor.x >= AssistantAnchor.margin)
    }

    // MARK: - The edges themselves

    @Test func everyEdgeKnowsWhichWayItPulls() {
        #expect(PanelResizeEdge.topLeading.isCorner)
        #expect(PanelResizeEdge.bottomTrailing.isCorner)
        #expect(!PanelResizeEdge.top.isCorner)
        #expect(!PanelResizeEdge.leading.isCorner)
        #expect(PanelResizeEdge.top.isVertical)
        #expect(!PanelResizeEdge.leading.isVertical)
        // All eight are reachable, so no edge of the panel is dead.
        #expect(PanelResizeEdge.allCases.count == 8)
    }
}
