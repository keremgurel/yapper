import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// Where Chirpy sits. Dragging it somewhere and then resizing the window must
/// never leave it off the edge, and opening it must not throw it across the
/// screen.
@Suite struct AssistantAnchorTests {
    private let bubble = CGSize(width: 62, height: 62)
    private let panel = CGSize(width: 420, height: 250)
    private let window = CGSize(width: 1400, height: 900)

    @Test func itStartsOutOfTheWayInTheBottomCorner() {
        let anchor = AssistantAnchor.initial(size: bubble, within: window)
        #expect(anchor.x == 1400 - 62 - AssistantAnchor.margin)
        #expect(anchor.y == 900 - 62 - AssistantAnchor.margin)
    }

    @Test func itCannotBeDraggedOffAnEdge() {
        let far = AssistantAnchor(x: 9_000, y: -400)
        let clamped = AssistantAnchor.clamped(far, size: bubble, within: window)
        #expect(clamped.x == 1400 - 62 - AssistantAnchor.margin)
        #expect(clamped.y == AssistantAnchor.margin)
    }

    /// A window shrunk smaller than the panel has nowhere legal to put it, so
    /// the margin gives way instead of the range inverting and the maths
    /// producing something absurd.
    @Test func aWindowTooSmallStillGivesAPosition() {
        let clamped = AssistantAnchor.clamped(
            AssistantAnchor(x: 500, y: 500),
            size: panel,
            within: CGSize(width: 200, height: 120)
        )
        #expect(clamped.x == AssistantAnchor.margin)
        #expect(clamped.y == AssistantAnchor.margin)
    }

    /// Opening it in the bottom-right has to grow up and to the left, or the
    /// panel would run off the corner it was called from.
    @Test func openingInACornerGrowsInwards() {
        let closed = AssistantAnchor.initial(size: bubble, within: window)

        let opened = AssistantAnchor.keepingEdges(
            closed,
            oldSize: bubble,
            newSize: panel,
            within: window
        )

        #expect(opened.x == 1400 - 420 - AssistantAnchor.margin)
        #expect(opened.y == 900 - 250 - AssistantAnchor.margin)
    }

    /// From the top-left it grows the other way: down and to the right, keeping
    /// the edge it was already against.
    @Test func openingAgainstTheTopLeftKeepsThatCorner() {
        let closed = AssistantAnchor(x: 16, y: 16)

        let opened = AssistantAnchor.keepingEdges(
            closed,
            oldSize: bubble,
            newSize: panel,
            within: window
        )

        #expect(opened.x == 16)
        #expect(opened.y == 16)
    }

    @Test func closingPutsItBackAgainstTheSameCorner() {
        let opened = AssistantAnchor(
            x: 1400 - 420 - AssistantAnchor.margin,
            y: 900 - 250 - AssistantAnchor.margin
        )

        let closed = AssistantAnchor.keepingEdges(
            opened,
            oldSize: panel,
            newSize: bubble,
            within: window
        )

        #expect(closed.x == 1400 - 62 - AssistantAnchor.margin)
        #expect(closed.y == 900 - 62 - AssistantAnchor.margin)
    }
}

/// Opening Chirpy places it once, whoever asked for it.
///
/// ⌘K, Escape and the bird itself all go through the same watcher, and it used
/// to shift an anchor that had already been placed for the size it was becoming.
/// Applying the growth twice threw the bird into the top left corner of the
/// window.
@Suite struct AssistantOpeningTests {
    private let bubble = CGSize(width: 62, height: 62)
    private let panel = CGSize(width: 560, height: 460)
    private let window = CGSize(width: 1400, height: 900)

    private func placed(_ placement: AssistantPlacement?, size: CGSize) -> AssistantAnchor {
        AssistantPlacement.anchor(for: size, lastPut: placement, within: window)
    }

    @Test func openingItHavingNeverMovedItLandsInTheBottomCorner() {
        // Never put anywhere, so there is nothing to convert from and `initial`
        // for the panel's own size is the answer.
        let opened = placed(nil, size: panel)
        #expect(opened.x == 1400 - 560 - AssistantAnchor.margin)
        #expect(opened.y == 900 - 460 - AssistantAnchor.margin)
        // Nowhere near the top left, which is where applying the growth on top
        // of that put it. Measured on the far corner: a panel this tall has its
        // own top-left above the middle of the window even when it is parked in
        // the bottom right.
        #expect(opened.x + panel.width == window.width - AssistantAnchor.margin)
        #expect(opened.y + panel.height == window.height - AssistantAnchor.margin)
    }

    @Test func openingItAfterMovingItKeepsTheCornerItWasNearest() {
        // Sitting in the bottom right as a bubble.
        let stored = AssistantAnchor.initial(size: bubble, within: window)
        let opened = AssistantAnchor.keepingEdges(
            stored,
            oldSize: bubble,
            newSize: panel,
            within: window
        )
        // The panel's bottom-right corner ends up where the bubble's was.
        #expect(opened.x + panel.width == stored.x + bubble.width)
        #expect(opened.y + panel.height == stored.y + bubble.height)
    }

    @Test func applyingTheGrowthTwiceIsWhatBrokeIt() {
        // The bug, written down: `initial` had already placed it for the panel,
        // and the watcher grew it again from there.
        let alreadyPlaced = AssistantAnchor.initial(size: panel, within: window)
        let shiftedAgain = AssistantAnchor.keepingEdges(
            alreadyPlaced,
            oldSize: bubble,
            newSize: panel,
            within: window
        )
        #expect(shiftedAgain != alreadyPlaced)
        // Far up and to the left of where it belongs.
        #expect(shiftedAgain.x < alreadyPlaced.x)
        #expect(shiftedAgain.y < alreadyPlaced.y)
    }

    @Test func closingItPutsTheBubbleBackInTheSameCorner() {
        let open = AssistantAnchor.initial(size: panel, within: window)
        let closed = AssistantAnchor.keepingEdges(
            open,
            oldSize: panel,
            newSize: bubble,
            within: window
        )
        #expect(closed.x + bubble.width == open.x + panel.width)
        #expect(closed.y + bubble.height == open.y + panel.height)
    }
}

/// Opening and closing are worked out while it is drawn, not corrected a frame
/// later. Everything below is the same call the view makes.
@Suite struct AssistantPlacementTests {
    private let bubble = CGSize(width: 62, height: 62)
    private let panel = CGSize(width: 560, height: 460)
    private let window = CGSize(width: 1400, height: 900)

    private func anchor(_ placement: AssistantPlacement?, for size: CGSize) -> AssistantAnchor {
        AssistantPlacement.anchor(for: size, lastPut: placement, within: window)
    }

    @Test func theSizeItWasPutAtIsReturnedUntouched() {
        let put = AssistantPlacement(anchor: AssistantAnchor(x: 300, y: 200), size: panel)
        #expect(anchor(put, for: panel) == put.anchor)
    }

    @Test func aDifferentSizeIsConvertedKeepingTheCornerItWasNearest() {
        let bubbleCorner = AssistantAnchor.initial(size: bubble, within: window)
        let put = AssistantPlacement(anchor: bubbleCorner, size: bubble)
        let opened = anchor(put, for: panel)
        // Same bottom-right corner, one pass, no second move.
        #expect(opened.x + panel.width == bubbleCorner.x + bubble.width)
        #expect(opened.y + panel.height == bubbleCorner.y + bubble.height)
    }

    @Test func openingIsIdempotent() {
        // The stored placement keeps the size it was put at, so every redraw
        // between opening and the next drag has to land on the same answer.
        let put = AssistantPlacement(
            anchor: AssistantAnchor.initial(size: bubble, within: window),
            size: bubble
        )
        let first = anchor(put, for: panel)
        let second = anchor(put, for: panel)
        #expect(first == second)
    }

    @Test func openingAndClosingReturnsItToWhereItStarted() {
        let start = AssistantAnchor.initial(size: bubble, within: window)
        let put = AssistantPlacement(anchor: start, size: bubble)
        let opened = anchor(put, for: panel)
        let closed = anchor(AssistantPlacement(anchor: opened, size: panel), for: bubble)
        #expect(closed == start)
    }

    @Test func aPanelDraggedAcrossTheWindowClosesBackToItsOwnCorner() {
        // Dragged to the top left and closed: the bubble follows it there rather
        // than springing back to where it was first opened from.
        let moved = AssistantPlacement(anchor: AssistantAnchor(x: 40, y: 40), size: panel)
        let closed = anchor(moved, for: bubble)
        #expect(closed.x == 40)
        #expect(closed.y == 40)
    }
}
